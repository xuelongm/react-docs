# 概览

在React中有那些行为可以触发状态更新：
- ReactDOM.render：在legacy模式下的HostRoot
- new ReactDOMRoot('').render：concurrent模式下的HostRoot
- this.setState：ClassComponent类型的更新
- this.forceUpdate：ClassComponent类型的更新
- useState：FunctionComponent类型的更新
- useReducer：FunctionComponent类型的更新

上面为React中触发更新的全部行为，这些行为背后究竟做了什么，保证了React可以在legacy或concurrent模式下的正确更新的呢？在进入正片开始之前，我们要有几个前置知识。

## Update对象

什么是`Update`对象呢？简单来说，`Update`对象为一种数据结构，主要分为两种类型，一种是为`ClassComponent`和`HostRoot`服务的结构，一种是为了`FunctionCompnent`服务的。

```tsx
// ClassComponent和HostRoot 类型的Update
export type Update<State> = {
  eventTime: number,
  lane: Lane,
  tag: 0 | 1 | 2 | 3,
  payload: any,
  callback: (() => mixed) | null,
  next: Update<State> | null,
};
// FunctionComponent 类型的update
type Update<S, A> = {
  lane: Lane,
  action: A,
  eagerReducer: ((S, A) => S) | null,
  eagerState: S | null,
  next: Update<S, A>,
  priority?: ReactPriorityLevel,
};

```

本章我们以`ClassComponent`和`HostRoot`状态更新为主，暂时可以忽略`FunctionComponent`类型的Update（下一章我们介绍Hooks时会详细的介绍）。那么让我们来看看各个字段的含义：

- eventTime：任务时间，通过`performance.now()`获取的毫秒数。
- lane：优先级字段，后面可能会涉及一部分优先级的内容。
- tag：更新类型：UpdateState， ReplaceState，  ForceUpdate ，CaptureUpdate。
- payload：payloay为setState的第一参数。
- callback：为setState的第二参数，会在Commit阶段调用，我们在Commit阶段讲过，这个参数会放入到`fiber.updateQueue.effects`中
- next：下个一个update

那么React中是怎么保存Update呢？

```jsx
class App extends React.Component {
  constructor() {
    this.state = {
      count: 1
    }
  }

  onclickHandler() {
    this.setState((count) => count + 1);
    this.setState((count) => count + 1);
  }

  render() {
    return (
      <>
        <div onClick={() => this.onclickHandler()}>{this.state.count}</div>
      </>
    )
  }
}
```

上面的栗子中，在React中会形成什么样的数据结构呢？

> 我们在`onclickHandler`调用了两次`setState`，那么渲染几次，答案是1次（因为是在onClick的回调中设置的，在React的消息中会触发批更新）。

```tsx
// update1 --> 表示第一次调用setState创建的Update
// update2 --> 表示第二次调用setState创建的Update
// 最终会形成一个环状链表
update1.next = update2;
update2.next = update2;
fiber.updateQueue.shared.pending = update2;
```

创建的Update会形成一个环状链表，并且挂载到`fiber.updateQueue.shared.pending`上。

我们来先看看Update环状链表创建函数`enqueueUpdate`

```tsx
export function enqueueUpdate<State>(fiber: Fiber, update: Update<State>) {
  const updateQueue = fiber.updateQueue;
  if (updateQueue === null) {
    return;
  }
  const sharedQueue: SharedQueue<State> = (updateQueue: any).shared;
  const pending = sharedQueue.pending;
  if (pending === null) {
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }
  sharedQueue.pending = update;
}
```

由代码可以看出，`enqueueUpdate`函数相当简单，下面我们举个栗子来说明这个链表形成的过程：

假设我们要创建四个Update，分别为：A，B，C，D，创建过程如下：

> 下面的pending即为fiber.updateQueue.pending

- 创建A，此时：pending === null，A.next = A &&  `fiber.updateQueue.pending ` = A，此时的链表：A.next === A，pending === A，pending.next === A。
- 创建B，当执行` update.next = pending.next`时，也就是B.next = A，形成环状，当执行`pending.next = update`时，也就是A.next = B，最后执行`sharedQueue.pending = update`，也就是pending === B。此时的链表：A.next === B，B.next === A, pending === B，pending.next === A。
- 创建C，当执行` update.next = pending.next`时，也就是C.next = A，形成环状，当执行`pending.next = update`时，也就是B.next = C，最后执行`sharedQueue.pending = update`，也就是pending === C。此时的链表：A.next === B，B.next === A, pending === B，pending.next === A。
- 创建D，重复上面创建C的过程。

> pending最终指向的是环状链表中的最后一个元素，而pending.next才是指向环状链表的第一个元素。



下面让我们看看`updateQueue`类型：

## updateQueue对象

```tsx
type SharedQueue<State> = {
  pending: Update<State> | null,
};

export type UpdateQueue<State> = {
  baseState: State,
  firstBaseUpdate: Update<State> | null,
  lastBaseUpdate: Update<State> | null,
  shared: SharedQueue<State>,
  effects: Array<Update<State>> | null,
};
```

`UpdateQueue`对象保存了当前fiber需要更新的全部`Update`（不仅仅是本次更新触发的Update）。

- baseState：本次更新的基础值，和`fiber.memoizedState`可能相等（上次更新，全部更新完成），也可能不相等（上次更新没有更新完成）。
- firstBaseUpdate：更新的开始Update，如果上次更新没有完全更新，本次计算开始时`firstBaseUpdate`不为空。
- lastBaseUpdate：更新最终的Update，如果上次更新没有完全更新，本次计算开始时`lastBaseUpdate`不为空。
- share：本次更新所有Update。
- effects：setState第二个参数。

好，下面让我们来看根据Update计算出memoizedState的过程`processUpdateQueue`函数：

> 下面函数比较复杂，我会详细的写注释，具体的流程可以重复跟踪下代码

```tsx
export function processUpdateQueue<State>(
  workInProgress: Fiber,
  props: any,
  instance: any,
  renderLanes: Lanes,
): void {
 // This is always non-null on a ClassComponent or HostRoot
  // 获取当前fiber的updateQueue
  const queue: UpdateQueue<State> = (workInProgress.updateQueue: any);

  hasForceUpdate = false;

  if (__DEV__) {
    currentlyProcessingQueue = queue.shared;
  }
  // 如果上次更新没有全部更新完成，当前的firstBaseUpdate不为null
  let firstBaseUpdate = queue.firstBaseUpdate;
  // 同上面的firstBaseUpdate
  let lastBaseUpdate = queue.lastBaseUpdate;

  // 获取本次更新的环状链表
  let pendingQueue = queue.shared.pending;
  // 如果本次有更新
  if (pendingQueue !== null) {
    // 重置pending，为下次更新做准备
    queue.shared.pending = null;
    // 上面说过，queue.shared.pending 是指向环状链表的最后一个元素
    // pengding.next 才是指向第一个元素
    const lastPendingUpdate = pendingQueue;
    // 获取第一个元素
    const firstPendingUpdate = lastPendingUpdate.next;
    // 剪断环状链表
    lastPendingUpdate.next = null;
    // 如果为空，则将当前链表设置为firstBaseUpdate
    if (lastBaseUpdate === null) {
      firstBaseUpdate = firstPendingUpdate;
    } else {
      // 如果lastBaseUpdate不为空，将当前链表加在后面
      lastBaseUpdate.next = firstPendingUpdate;
    }
    // 更新最终的链表
    lastBaseUpdate = lastPendingUpdate;

    // 讲当前链表加在 workInProgress.alternate链表的后面，防止被打断后数据丢失
    // 此处要记住，react更新都是从root开始，且只存在一棵workInProgress树
    const current = workInProgress.alternate;
    if (current !== null) {
      // This is always non-null on a ClassComponent or HostRoot
      const currentQueue: UpdateQueue<State> = (current.updateQueue: any);
      const currentLastBaseUpdate = currentQueue.lastBaseUpdate;
      if (currentLastBaseUpdate !== lastBaseUpdate) {
        if (currentLastBaseUpdate === null) {
          currentQueue.firstBaseUpdate = firstPendingUpdate;
        } else {
          currentLastBaseUpdate.next = firstPendingUpdate;
        }
        currentQueue.lastBaseUpdate = lastPendingUpdate;
      }
    }
  }
  // 这个fiber有更新
  if (firstBaseUpdate !== null) {
    // 获取更新的base
    let newState = queue.baseState;
    // 优先级
    let newLanes = NoLanes;
    // 这个变量是为了本次更新优先级不同，在遇到第一个低优先级时，保存前面已计算的base
    let newBaseState = null;
    // 不同优先级时，保存第一个遇到的低优先级的update
    let newFirstBaseUpdate = null;
    // // 不同优先级时，本次未更新的最后一个update
    let newLastBaseUpdate = null;

    let update = firstBaseUpdate;
    do {
      const updateLane = update.lane;
      const updateEventTime = update.eventTime;
      // 判断优先级是否在本次更新的优先级之内，如果不在，则跳过本次updata
      if (!isSubsetOfLanes(renderLanes, updateLane)) {
        // Priority is insufficient. Skip this update. If this is the first
        // skipped update, the previous update/state is the new base
        // update/state.
        const clone: Update<State> = {
          eventTime: updateEventTime,
          lane: updateLane,

          tag: update.tag,
          payload: update.payload,
          callback: update.callback,

          next: null,
        };
        if (newLastBaseUpdate === null) {
          // 低于本次更新的第一个update
          newFirstBaseUpdate = newLastBaseUpdate = clone;
          // 保存前面已计算出来的base
          newBaseState = newState;
        } else {
          newLastBaseUpdate = newLastBaseUpdate.next = clone;
        }
        // Update the remaining priority in the queue.
        // 更新优先级
        newLanes = mergeLanes(newLanes, updateLane);
      } else {
        // This update does have sufficient priority.
        // 如果有跳过的更新，要从跳过更新处后，所有的update都要保存
        if (newLastBaseUpdate !== null) {
          const clone: Update<State> = {
            eventTime: updateEventTime,
            // This update is going to be committed so we never want uncommit
            // it. Using NoLane works because 0 is a subset of all bitmasks, so
            // this will never be skipped by the check above.
            lane: NoLane,

            tag: update.tag,
            payload: update.payload,
            callback: update.callback,

            next: null,
          };
          newLastBaseUpdate = newLastBaseUpdate.next = clone;
        }

        // Process this update.
        // 更新state
        newState = getStateFromUpdate(
          workInProgress,
          queue,
          update,
          newState,
          props,
          instance,
        );
        // 是否有callback，如果有callback，则将callback，保存在effects中，在commit阶段调用
        const callback = update.callback;
        if (callback !== null) {
          workInProgress.flags |= Callback;
          const effects = queue.effects;
          if (effects === null) {
            queue.effects = [update];
          } else {
            effects.push(update);
          }
        }
      }
      // 下一个要更新的update
      update = update.next;
      // 已更新完成
      if (update === null) {
        pendingQueue = queue.shared.pending;
        if (pendingQueue === null) {
          break;
        } else {
          // 为了处理在update过程中有触发了update。非推荐做法
          // An update was scheduled from inside a reducer. Add the new
          // pending updates to the end of the list and keep processing.
          const lastPendingUpdate = pendingQueue;
          // Intentionally unsound. Pending updates form a circular list, but we
          // unravel them when transferring them to the base queue.
          const firstPendingUpdate = ((lastPendingUpdate.next: any): Update<State>);
          lastPendingUpdate.next = null;
          update = firstPendingUpdate;
          queue.lastBaseUpdate = lastPendingUpdate;
          queue.shared.pending = null;
        }
      }
    } while (true);
    // 表示没有跳过的低优先级更新
    if (newLastBaseUpdate === null) {
      newBaseState = newState;
    }

    // 保存baseState
    queue.baseState = ((newBaseState: any): State);
    queue.firstBaseUpdate = newFirstBaseUpdate;
    queue.lastBaseUpdate = newLastBaseUpdate;

    // Set the remaining expiration time to be whatever is remaining in the queue.
    // This should be fine because the only two other things that contribute to
    // expiration time are props and context. We're already in the middle of the
    // begin phase by the time we start processing the queue, so we've already
    // dealt with the props. Context in components that specify
    // shouldComponentUpdate is tricky; but we'll have to account for
    // that regardless.
    markSkippedUpdateLanes(newLanes);
    workInProgress.lanes = newLanes;
    workInProgress.memoizedState = newState;
  }

  if (__DEV__) {
    currentlyProcessingQueue = null;
  }
}
```

看完上面代码，不知道同学是否会产生两个疑问：

1. React在render阶段是可以被中断的，中断后，React需要从root阶段重新构建workInProgess树，那么当前的update是否会丢失呢？
2. React中是如何保证状态的依赖性呢？

> 如果要搞清楚这个问题，就要涉及到React中的优先级了，还要涉及React中调度优先级和Lanes优先级的相互转换问题，本章中，我们先认为这个两个优先级是等价的（后面将React中调度的时候回详细讲）。

## 正确性

在React中，高优先级的任务可以中断低优先级的任务，中断任务后，React会从Root从新构建workInProgress，当前构建的workInprogress会被舍弃掉，那么React是怎么保存本次的Update呢？其实很简单，我们都知道，React中总会维护两棵树，current Tree和workInprogress Tree，current Tree在commit之前，会一直保存，所以把需要更新的Update保存在current Tree中即可。

代码如下：

```tsx
if (current !== null) {
  // This is always non-null on a ClassComponent or HostRoot
  const currentQueue: UpdateQueue<State> = (current.updateQueue: any);
  const currentLastBaseUpdate = currentQueue.lastBaseUpdate;
  if (currentLastBaseUpdate !== lastBaseUpdate) {
    if (currentLastBaseUpdate === null) {
      currentQueue.firstBaseUpdate = firstPendingUpdate;
    } else {
      currentLastBaseUpdate.next = firstPendingUpdate;
    }
    currentQueue.lastBaseUpdate = lastPendingUpdate;
  }
}
```

> 在commit中，workInProgress Tree会被替换到current Tree，也就保证更新完成后，update的正确性

## update状态的连续性

我们都知道update是有优先级（也就是lane字段），如果某个update的优先级低于本次更新的优先级，会被跳过去，那么下次跟新保证数据的连续性。在代码中注释给了完整的解释。

我们来看看代码注释中给的解释：

```tsx
// For example:
//
//   Given a base state of '', and the following queue of updates
//
//     A1 - B2 - C1 - D2
//
//   where the number indicates the priority, and the update is applied to the
//   previous state by appending a letter, React will process these updates as
//   two separate renders, one per distinct priority level:
//
//   First render, at priority 1:
//     Base state: ''
//     Updates: [A1, C1]
//     Result state: 'AC'
//
//   Second render, at priority 2:
//     Base state: 'A'            <-  The base state does not include C1,
//                                    because B2 was skipped.
//     Updates: [B2, C1, D2]      <-  C1 was rebased on top of B2
//     Result state: 'ABCD'
//
// Because we process updates in insertion order, and rebase high priority
// updates when preceding updates are skipped, the final result is deterministic
// regardless of priority. Intermediate state may vary according to system
// resources, but the final state is always the same.
```

下面我来翻译下这段注释：

好比我们有四个Update，A1，B2，C1，D2，期中数字代表优先级，数字越低优先级越高，A，B，C，D代表更新的内容。

- 第一次更新，优先级为1

  base state: ''

  update：[A1, C1]

  fiber.memoizedState：AC

  此次更新中，会跳过B2更新，只会根据base state 和A1，C1，计算出最终的结果AC，同时此时的base state 为 'A'

- 第二次更新，优先级为2

  base state: 'A'

  update：[B2, C1,D2]

  fiber.memoizedState：ABCD

  此次更新，base state为'A'，在根据base state 和B2，C1，D2，计算出最终的结果ABCD，同时此时的base state 为 ''

上面的栗子我们可以看出，React不保证中间状态的正确行，只保证最终结果的正确。

> 其实这个也很好理解，这个很像Git的`rebase`。很多逻辑是相同

**下一章我们将介绍React.render()和this.setState的完整过程。**

