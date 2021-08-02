> *Hooks* 是 React 16.8 的新增特性。它可以让你在不编写 class 的情况下使用 state 以及其他的 React 特性。
>
> *Hooks*是`FunctionComponent`的补充，不会替代`ClassComponent`

## 没有破坏性改动

在我们继续之前，请记住 Hook 是：

- **完全可选的。** 你无需重写任何已有代码就可以在一些组件中尝试 Hook。但是如果你不想，你不必现在就去学习或使用 Hook。
- **100% 向后兼容的。** Hook 不包含任何破坏性改动。
- **现在可用。** Hook 已发布于 v16.8.0。

**没有计划从 React 中移除 class。** 你可以在本页[底部的章节](https://react.docschina.org/docs/hooks-intro.html#gradual-adoption-strategy)读到更多关于 Hook 的渐进策略。

**Hook 不会影响你对 React 概念的理解。** 恰恰相反，Hook 为已知的 React 概念提供了更直接的 API：props， state，context，refs 以及生命周期。稍后我们将看到，Hook 还提供了一种更强大的方式来组合他们。

**如果不想了解添加 Hook 的具体原因，可以直接[跳到下一章节开始学习 Hook！](https://react.docschina.org/docs/hooks-overview.html)** 当然你也可以继续阅读这一章节来了解原因，并且可以学习到如何在不重写应用的情况下使用 Hook。

## 数据结构

在我们正式进入学习之前，我们需要了解写React有关`Hooks`的数据结构

- dispatcher

  在React中有两种`dispatcher`，一种用于`Hooks`的创建，一种用于`Hooks`的更新

```tsx
// 用于挂载的Dispatcher
const HooksDispatcherOnMount: Dispatcher = {
  readContext,

  useCallback: mountCallback,
  useContext: readContext,
  useEffect: mountEffect,
  useImperativeHandle: mountImperativeHandle,
  useLayoutEffect: mountLayoutEffect,
  useMemo: mountMemo,
  useReducer: mountReducer,
  useRef: mountRef,
  useState: mountState,
  useDebugValue: mountDebugValue,
  useDeferredValue: mountDeferredValue,
  useTransition: mountTransition,
  useMutableSource: mountMutableSource,
  useOpaqueIdentifier: mountOpaqueIdentifier,

  unstable_isNewReconciler: enableNewReconciler,
};

// 用于更新的Dispatcher
const HooksDispatcherOnUpdate: Dispatcher = {
  readContext,

  useCallback: updateCallback,
  useContext: readContext,
  useEffect: updateEffect,
  useImperativeHandle: updateImperativeHandle,
  useLayoutEffect: updateLayoutEffect,
  useMemo: updateMemo,
  useReducer: updateReducer,
  useRef: updateRef,
  useState: updateState,
  useDebugValue: updateDebugValue,
  useDeferredValue: updateDeferredValue,
  useTransition: updateTransition,
  useMutableSource: updateMutableSource,
  useOpaqueIdentifier: updateOpaqueIdentifier,

  unstable_isNewReconciler: enableNewReconciler,
};

```

有上面代码可以看出，在`mount`阶段和`update`阶段`Hooks`调用的函数是不同。

`FunctionComponent`在调用`Render`之前会根据`FunctionComponent`对应的Fiber的数据情况来判断调用那个`Dispatcher`；

```tsx
// 以下代码在`renderWithHooks`中调用
ReactCurrentDispatcher.current = 
  current === null || current.memoizedState === null 
  ? HooksDispatcherOnMount : HooksDispatcherOnUpdate;
// render调用
let children = Component(props, secondArg);
```

那么就一个问题了，`Dispatcher`是怎么切换的呢？那就要看真是的`Hooks`的实现了，我们以`setState`为例：

```tsx
export function useState<S>(
  initialState: (() => S) | S,
): [S, Dispatch<BasicStateAction<S>>] {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
}

function resolveDispatcher() {
  const dispatcher = ReactCurrentDispatcher.current;
  return dispatcher;
}
```

可以看到，我们每次在调用`useState`是，`useState`会从全局获取`ReactCurrentDispatcher.current`，从而保证我们在`mount`和`update`阶段可以调用不同的`Dispatcher`。

> 在react中共有四中不同的`Dispatcher`，在这里我们介绍了两种，感兴趣的同学可以详细的研究每一种的`Dispatcher`的用法

- HOOK

`HOOK`数据结构，就是我们在调用`Hooks`时创建的数据结构：

```tsx
export type Hook = {
  memoizedState: any,
  baseState: any,
  baseQueue: Update<any, any> | null,
  queue: UpdateQueue<any, any> | null,
  next: Hook | null,
};
```

可以看出`HOOK`的数据结构和`UpdateQueue`很像，在`HOOK`中多了`memoizedState`，那么这个变量是干什么的？

不同类型`hook`的`memoizedState`保存不同类型数据，具体如下：

- useState： `memoizedState`保存了state值
- useReducer：  `memoizedState`保存了state值
- useEffect：  `memoizedState`保存了`Effect`数据结构，effect中保存了`useEffect`的回调函数，依赖项，销毁函数等。

```tsx
export type Effect = {
  tag: HookFlags,
  create: () => (() => void) | void,
  destroy: (() => void) | void,
  deps: Array<mixed> | null,
  next: Effect,
};
```

- useRef：   `memoizedState`保存了{current: null}的对象
- useMemo：  `memoizedState`保存了[callback()，deps]
- useCallback：  `memoizedState`保存了[callback，deps]，注意，其中`useMemo`保存的`callback`执行的结果，而`useCallback`保存的`callback`函数本身
- 有些`hook`是没有`memoizedState`的，比如：useContext

## 极简实现

关于`Hooks`的极简实现请参考：https://juejin.cn/post/6970872955819524103

下面几让我们进入源码阶段。

## 入口

所有`Hooks`的都是useXX，那么让我们来看看这些`use`函数做什么？

```tsx

export function useState<S>(
  initialState: (() => S) | S,
): [S, Dispatch<BasicStateAction<S>>] {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
}

export function useReducer<S, I, A>(
  reducer: (S, A) => S,
  initialArg: I,
  init?: I => S,
): [S, Dispatch<A>] {
  const dispatcher = resolveDispatcher();
  return dispatcher.useReducer(reducer, initialArg, init);
}

export function useRef<T>(initialValue: T): {|current: T|} {
  const dispatcher = resolveDispatcher();
  return dispatcher.useRef(initialValue);
}

export function useEffect(
  create: () => (() => void) | void,
  deps: Array<mixed> | void | null,
): void {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, deps);
}

export function useLayoutEffect(
  create: () => (() => void) | void,
  deps: Array<mixed> | void | null,
): void {
  const dispatcher = resolveDispatcher();
  return dispatcher.useLayoutEffect(create, deps);
}

export function useCallback<T>(
  callback: T,
  deps: Array<mixed> | void | null,
): T {
  const dispatcher = resolveDispatcher();
  return dispatcher.useCallback(callback, deps);
}

export function useMemo<T>(
  create: () => T,
  deps: Array<mixed> | void | null,
): T {
  const dispatcher = resolveDispatcher();
  return dispatcher.useMemo(create, deps);
}
// ...省略一些Hooks
```

有代码可以看出，所有的`use`函数，都是调用`resolveDispatcher`获取`Dispatcher`，调用用相应的`use`函数。

那么下面我们来看看这些`Hooks`的实现。

## useState和useReducer

[`useState`](https://react.docschina.org/docs/hooks-reference.html#usestate) 的替代方案。它接收一个形如 `(state, action) => newState` 的 reducer，并返回当前的 state 以及与其配套的 `dispatch` 方法。（如果你熟悉 Redux 的话，就已经知道它如何工作了。）

在某些场景下，`useReducer` 会比 `useState` 更适用，例如 state 逻辑较复杂且包含多个子值，或者下一个 state 依赖于之前的 state 等。并且，使用 `useReducer` 还能给那些会触发深更新的组件做性能优化，因为[你可以向子组件传递 `dispatch` 而不是回调函数](https://react.docschina.org/docs/hooks-faq.html#how-to-avoid-passing-callbacks-down) 。

本节我们开始介绍两个`Hooks`的实现。我们知道，在`mount`阶段和`update`阶段，`Hooks`调用的函数是不相同。我们先从`mount`阶段看起。

### mount

`useState`在`mount`阶段，调用的`mountState`，而`useRed`在`mount`阶段会调用`mountReducer`函数：

```tsx
function mountState<S>(
  initialState: (() => S) | S,
): [S, Dispatch<BasicStateAction<S>>] {
    // 创建hook对象，并将hook挂载到Fiber
    const hook = mountWorkInProgressHook();
    if (typeof initialState === 'function') {
      // $FlowFixMe: Flow doesn't like mixed types
      initialState = initialState();
    }
    // 赋值state
    hook.memoizedState = hook.baseState = initialState;
    // 创建queue
    const queue = (hook.queue = {
      pending: null,
      dispatch: null,
      lastRenderedReducer: basicStateReducer, // 设置默认的basicStateReducer
      lastRenderedState: (initialState: any),
    });
    // 创建dispatch
    const dispatch: Dispatch<
      BasicStateAction<S>,
    > = (queue.dispatch = (dispatchAction.bind(
      null,
      currentlyRenderingFiber,
      queue,
    ): any));
    return [hook.memoizedState, dispatch];
}

function mountReducer<S, I, A>(
  reducer: (S, A) => S,
  initialArg: I,
  init?: I => S,
): [S, Dispatch<A>] {
  const hook = mountWorkInProgressHook();
  let initialState;
  if (init !== undefined) {
    initialState = init(initialArg);
  } else {
    initialState = ((initialArg: any): S);
  }
  hook.memoizedState = hook.baseState = initialState;
  const queue = (hook.queue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: reducer, // 使用传入的reducer
    lastRenderedState: (initialState: any),
  });
  const dispatch: Dispatch<A> = (queue.dispatch = (dispatchAction.bind(
    null,
    currentlyRenderingFiber,
    queue,
  ): any));
  return [hook.memoizedState, dispatch];
}
```

我们对比下两个函数，他们只有细微的差别：

- 获取initialState方式，有细微不同
- 创建queue时，`setState`使用的是默认reducer，而`useReducer`使用的传入的reducer

`basicStateReducer`方法如下：

```tsx
function basicStateReducer<S>(state: S, action: BasicStateAction<S>): S {
  // $FlowFixMe: Flow doesn't like mixed types
  return typeof action === 'function' ? action(state) : action;
}
```

由此可见，`setState`只是使用`basicStateReducer`的`useReducer`。

> 将`Hooks`挂载到Fiber上，这一步是在`mountWorkInProgressHook`中完成的
>
> ```tsx
> function mountWorkInProgressHook(): Hook {
>   const hook: Hook = {
>     memoizedState: null,
> 
>     baseState: null,
>     baseQueue: null,
>     queue: null,
> 
>     next: null,
>   };
> 
>   if (workInProgressHook === null) {
>     // 将hooks挂载到Fiber上个
>     currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
>   } else {
>     // 形成链表
>     workInProgressHook = workInProgressHook.next = hook;
>   }
>   // workInProgressHook 会在调用完Render后设置为null
>   return workInProgressHook;
> }
> ```
>
> 

### update

在`update`阶段，这两个`Hooks`分别调用`updateState`和`updateReducer`，其中`updateState`只是对`updateReducer`的封装，如下：

```tsx
function updateState<S>(
  initialState: (() => S) | S,
): [S, Dispatch<BasicStateAction<S>>] {
  return updateReducer(basicStateReducer, (initialState: any));
}
```

也就是说，`updateState`是以`basicStateReducer`参数的`updateReducer`。那么下面我们重点关注下`updateReducer`的实现。

> 在更新阶段，`Hooks`链表已经存在在Fiber上了

```tsx
function updateReducer<S, I, A>(
  reducer: (S, A) => S,
  initialArg: I,
  init?: I => S,
): [S, Dispatch<A>] {
    // 获取hook
    // 获取hook是靠next指针获取的，每次获取一次，next向后移动一个，是个顺序遍历，如果我们将hook放到if条件中，就可能出现错误
    const hook = updateWorkInProgressHook();
    const queue = hook.queue;
    invariant(
      queue !== null,
      'Should have a queue. This is likely a bug in React. Please file an issue.',
    );
    
    // 修改renducer函数
    queue.lastRenderedReducer = reducer;

    const current: Hook = (currentHook: any);

    // The last rebase update that is NOT part of the base state.
    // 渲染树上的baseQueue，可能是因为中断，保存的上一次的updateQueue
    let baseQueue = current.baseQueue;

    // The last pending update that hasn't been processed yet.
    // 将当前的pending挂载到current.baseQueue上
    const pendingQueue = queue.pending;
    if (pendingQueue !== null) {
      // We have new updates that haven't been processed yet.
      // We'll add them to the base queue.
      if (baseQueue !== null) {
        // Merge the pending queue and the base queue.
        const baseFirst = baseQueue.next;
        const pendingFirst = pendingQueue.next;
        baseQueue.next = pendingFirst;
        pendingQueue.next = baseFirst;
      }
      if (__DEV__) {
        if (current.baseQueue !== baseQueue) {
          // Internal invariant that should never happen, but feasibly could in
          // the future if we implement resuming, or some form of that.
          console.error(
            'Internal error: Expected work-in-progress queue to be a clone. ' +
              'This is a bug in React.',
          );
        }
      }
      current.baseQueue = baseQueue = pendingQueue;
      queue.pending = null;
    }

    // 计算出newState
    if (baseQueue !== null) {
      // We have a queue to process.
      const first = baseQueue.next;
      let newState = current.baseState;

      let newBaseState = null;
      let newBaseQueueFirst = null;
      let newBaseQueueLast = null;
      let update = first;
      do {
        const updateLane = update.lane;
        if (!isSubsetOfLanes(renderLanes, updateLane)) {
          // Priority is insufficient. Skip this update. If this is the first
          // skipped update, the previous update/state is the new base
          // update/state.
          const clone: Update<S, A> = {
            lane: updateLane,
            action: update.action,
            eagerReducer: update.eagerReducer,
            eagerState: update.eagerState,
            next: (null: any),
          };
          if (newBaseQueueLast === null) {
            newBaseQueueFirst = newBaseQueueLast = clone;
            newBaseState = newState;
          } else {
            newBaseQueueLast = newBaseQueueLast.next = clone;
          }
          // Update the remaining priority in the queue.
          // TODO: Don't need to accumulate this. Instead, we can remove
          // renderLanes from the original lanes.
          currentlyRenderingFiber.lanes = mergeLanes(
            currentlyRenderingFiber.lanes,
            updateLane,
          );
          markSkippedUpdateLanes(updateLane);
        } else {
          // This update does have sufficient priority.

          if (newBaseQueueLast !== null) {
            const clone: Update<S, A> = {
              // This update is going to be committed so we never want uncommit
              // it. Using NoLane works because 0 is a subset of all bitmasks, so
              // this will never be skipped by the check above.
              lane: NoLane,
              action: update.action,
              eagerReducer: update.eagerReducer,
              eagerState: update.eagerState,
              next: (null: any),
            };
            newBaseQueueLast = newBaseQueueLast.next = clone;
          }

          // Process this update.
          if (update.eagerReducer === reducer) {
            // If this update was processed eagerly, and its reducer matches the
            // current reducer, we can use the eagerly computed state.
            newState = ((update.eagerState: any): S);
          } else {
            const action = update.action;
            newState = reducer(newState, action);
          }
        }
        update = update.next;
      } while (update !== null && update !== first);

      if (newBaseQueueLast === null) {
        newBaseState = newState;
      } else {
        newBaseQueueLast.next = (newBaseQueueFirst: any);
      }

      // Mark that the fiber performed work, but only if the new state is
      // different from the current state.
      if (!is(newState, hook.memoizedState)) {
        markWorkInProgressReceivedUpdate();
      }

      hook.memoizedState = newState;
      hook.baseState = newBaseState;
      hook.baseQueue = newBaseQueueLast;

      queue.lastRenderedState = newState;
    }
		// 返回新的newState和dispatch
    const dispatch: Dispatch<A> = (queue.dispatch: any);
    return [hook.memoizedState, dispatch];
}
```

此函数的流程可以用一句话概括，获取`Hook`，并根据`Hook`，计算出最新的`state`。

获取`Hook`的函数为`updateWorkInProgressHook`，此函数和`mountWorkInProgressHook`有些区别，主要区别在与`mount`阶段的`Hooks`是创建得到，而这个是根据渲染树获取的。

> 注意`useReducer`中的action是每次都可以修改的`queue.lastRenderedReducer = reducer;`

### 触发更新

触发更新的函数为`dispatchAction`，在调用此函数的时，当前`FunctionCompoent`对应的`Fiber`和`Hooks`对应的`queue`已经通过`bind`绑定了参数中。

```tsx
newQueue.dispatch = setSnapshot = (dispatchAction.bind(
  null,
  currentlyRenderingFiber,
  newQueue,
): any);
```



> 在React中大量使用bind进行柯里化，优化传参

```tsx
function dispatchAction<S, A>(
  fiber: Fiber,
  queue: UpdateQueue<S, A>,
  action: A,
) {
    // 获取时间
    const eventTime = requestEventTime();
    // 获取优先级
    const lane = requestUpdateLane(fiber);
		
    // 创建update
    const update: Update<S, A> = {
      lane,
      action,
      eagerReducer: null,
      eagerState: null,
      next: (null: any),
    };

    // 将update形成环装链表。
    // 注意此处的queue为hooks.queue
    const pending = queue.pending;
    if (pending === null) {
      // This is the first update. Create a circular list.
      update.next = update;
    } else {
      update.next = pending.next;
      pending.next = update;
    }
    queue.pending = update;
		// 获取当前workInProgress
    const alternate = fiber.alternate;
    if (
      fiber === currentlyRenderingFiber ||
      (alternate !== null && alternate === currentlyRenderingFiber)
    ) {
      // 表示当前为更新过程中触发的更新
      didScheduleRenderPhaseUpdateDuringThisPass = didScheduleRenderPhaseUpdate = true;
    } else {
      // 当第一次更新时的优化
      if (
        fiber.lanes === NoLanes &&
        (alternate === null || alternate.lanes === NoLanes)
      ) {
        const lastRenderedReducer = queue.lastRenderedReducer;
        if (lastRenderedReducer !== null) {
          let prevDispatcher;
          try {
            const currentState: S = (queue.lastRenderedState: any);
            const eagerState = lastRenderedReducer(currentState, action);
            update.eagerReducer = lastRenderedReducer;
            update.eagerState = eagerState;
            if (is(eagerState, currentState)) {
              return;
            }
          } catch (error) {
          } finally {
            if (__DEV__) {
              ReactCurrentDispatcher.current = prevDispatcher;
            }
          }
        }
      }
      
      // 调度起更新
      scheduleUpdateOnFiber(fiber, lane, eventTime);
    }

    if (enableSchedulingProfiler) {
      markStateUpdateScheduled(fiber, lane);
    }
}
```

在此函数中，有以下几点需要注意

- currentlyRenderingFiber：表示workInProgress，只有在更新阶段才存在，`dispatchAction`还未到更新阶段，如果不是在渲染中触发的更新，`currentlyRenderingFiber`肯定为null
- 第一次触发更新时，会有个优化

## useMemo 和 useCallback

首先区别下这两个`Hooks`作用：

- useMemo：是根据依赖来缓存值，只有在依赖发生变化的时候，才会产生新的值。
- useCallback：根据依赖来缓存函数，只有在依赖发生变化时，才会返回新的函数，可以优化效率

这两个函数在所有的`Hooks`中算是最简单的两个`Hook`了

### mount

```tsx
function mountMemo<T>(
nextCreate: () => T,
 deps: Array<mixed> | void | null,
): T {
  // 获取当前的Hooks
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const nextValue = nextCreate();
  // 将value和nextDeps保存在memoizedState中
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}


function mountCallback<T>(callback: T, deps: Array<mixed> | void | null): T {
  // 获取当前的Hooks
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  // 保存callback和nextDeps
  hook.memoizedState = [callback, nextDeps];
  return callback;
}

```

由代码可以看出，`mountMemo`和`mountCallback`唯一的却别在于，`mountMemo`会根据`nextCreate`计算出value，保存在`memoizedState`中，而`mountCallback`直接将`callback`保存在`memoizedState`。

### update

```tsx
function updateMemo<T>(
nextCreate: () => T,
 deps: Array<mixed> | void | null,
): T {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const prevState = hook.memoizedState;
  if (prevState !== null) {
    if (nextDeps !== null) {
      // 对比deps是否相等，如相等直接放回prevState[0]
      const prevDeps: Array<mixed> | null = prevState[1];
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        return prevState[0];
      }
    }
  }
	// 如果不想等，根据nextCreate创建新的value
  const nextValue = nextCreate();
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

function updateCallback<T>(callback: T, deps: Array<mixed> | void | null): T {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const prevState = hook.memoizedState;
  if (prevState !== null) {
    if (nextDeps !== null) {
			// 对比deps是否相等，如果相等，直接放回
      const prevDeps: Array<mixed> | null = prevState[1];
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        return prevState[0];
      }
    }
  }
  // 创建新的memoizedState
  hook.memoizedState = [callback, nextDeps];
  return callback;
}
```

## useRef

> 本质上，`useRef` 就像是可以在其 `.current` 属性中保存一个可变值的“盒子”。
>
> 你应该熟悉 ref 这一种[访问 DOM](https://react.docschina.org/docs/refs-and-the-dom.html) 的主要方式。如果你将 ref 对象以 `<div ref={myRef} />` 形式传入组件，则无论该节点如何改变，React 都会将 ref 对象的 `.current` 属性设置为相应的 DOM 节点。
>
> 然而，`useRef()` 比 `ref` 属性更有用。它可以[很方便地保存任何可变值](https://react.docschina.org/docs/hooks-faq.html#is-there-something-like-instance-variables)，其类似于在 class 中使用实例字段的方式。
>
> 这是因为它创建的是一个普通 Javascript 对象。而 `useRef()` 和自建一个 `{current: ...}` 对象的唯一区别是，`useRef` 会在每次渲染时返回同一个 ref 对象。

`useRef`的实现相当简单：

```tsx
function mountRef<T>(initialValue: T): {|current: T|} {
  const hook = mountWorkInProgressHook();
  const ref = {current: initialValue};
  if (__DEV__) {
    Object.seal(ref);
  }
  hook.memoizedState = ref;
  return ref;
}

function updateRef<T>(initialValue: T): {|current: T|} {
  const hook = updateWorkInProgressHook();
  return hook.memoizedState;
}
```

由代码可以看出，`useRef`的实现相当简单。

## useEffect 和 useLayoutEffect

`useEffect`和`useLayoutEffect`都是执行副作用的`Hooks`，只是执行的时机不同。

与 `componentDidMount`、`componentDidUpdate` 不同的是，在浏览器完成布局与绘制**之后**，传给 `useEffect` 的函数会延迟调用。这使得它适用于许多常见的副作用场景，比如设置订阅和事件处理等情况，因此不应在函数中执行阻塞浏览器更新屏幕的操作。

然而，并非所有 effect 都可以被延迟执行。例如，在浏览器执行下一次绘制前，用户可见的 DOM 变更就必须同步执行，这样用户才不会感觉到视觉上的不一致。（概念上类似于被动监听事件和主动监听事件的区别。）React 为此提供了一个额外的 [`useLayoutEffect`](https://react.docschina.org/docs/hooks-reference.html#uselayouteffect) Hook 来处理这类 effect。它和 `useEffect` 的结构相同，区别只是调用时机不同。

虽然 `useEffect` 会在浏览器绘制后延迟执行，但会保证在任何新的渲染前执行。React 将在组件更新前刷新上一轮渲染的 effect。

### mount

```tsx
function mountEffect(
  create: () => (() => void) | void,
  deps: Array<mixed> | void | null,
): void {
  return mountEffectImpl(
    UpdateEffect | PassiveEffect,
    HookPassive,
    create,
    deps,
  );
}

function mountLayoutEffect(
  create: () => (() => void) | void,
  deps: Array<mixed> | void | null,
): void {
  return mountEffectImpl(UpdateEffect, HookLayout, create, deps);
}


```

有代码可以看出，`useEffect`和`useLayoutEffect`都是调用`mountEffectImpl`函数，`useEffect`传入的参数为`HookPassive`，而`useLayoutEffect`为`HookLayout`。

那么让我们来看看`mountEffectImpl`的实现：

```tsx
function mountEffectImpl(fiberFlags, hookFlags, create, deps): void {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  currentlyRenderingFiber.flags |= fiberFlags;
  hook.memoizedState = pushEffect(
    HookHasEffect | hookFlags,
    create,
    undefined,
    nextDeps,
  );
}

function pushEffect(tag, create, destroy, deps) {
  const effect: Effect = {
    tag,
    create,
    destroy,
    deps,
    // Circular
    next: (null: any),
  };
  let componentUpdateQueue: null | FunctionComponentUpdateQueue = (currentlyRenderingFiber.updateQueue: any);
  if (componentUpdateQueue === null) {
    componentUpdateQueue = createFunctionComponentUpdateQueue();
    currentlyRenderingFiber.updateQueue = (componentUpdateQueue: any);
    componentUpdateQueue.lastEffect = effect.next = effect;
  } else {
    const lastEffect = componentUpdateQueue.lastEffect;
    if (lastEffect === null) {
      componentUpdateQueue.lastEffect = effect.next = effect;
    } else {
      const firstEffect = lastEffect.next;
      lastEffect.next = effect;
      effect.next = firstEffect;
      componentUpdateQueue.lastEffect = effect;
    }
  }
  return effect;
}
```

在`mountEffectImpl`函数中所做的只是，获取`hook`，通过`pushEffect`函数将`effect`挂载到`hoook.memoizedState`上。

`pushEffect`所做的只是将`effect`形成一个环状链表，并将最后一个节点，返回。

> 注意：effect的数据结构中包含：tag（类型），create（effect函数），destroy（effect函数的返回函数），deps（依赖性），next（下一个）

### update

和`mount`阶段想同，`useEffect`和`useLayoutEffect`想同，底层都是调用[`updateEffectImpl`](https://github.com/facebook/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberWorkLoop.old.js#L2458)函数，唯一却别的就是传参不同。

```tsx
function updateEffectImpl(fiberFlags, hookFlags, create, deps): void {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  let destroy = undefined;
	
  if (currentHook !== null) {
    const prevEffect = currentHook.memoizedState;
    destroy = prevEffect.destroy;
    // 判断deps
    if (nextDeps !== null) {
      const prevDeps = prevEffect.deps;
      // 相同
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        pushEffect(hookFlags, create, destroy, nextDeps);
        return;
      }
    }
  }

  currentlyRenderingFiber.flags |= fiberFlags;
	// deps 不相同
  hook.memoizedState = pushEffect(
    HookHasEffect | hookFlags,
    create,
    destroy,
    nextDeps,
  );
}

```

从上面代码，不知道同学会不会产生一个疑问，什么**deps**相同的情况也进行了了`pushEffect`？有代码可以看出**deps**相同和不相同两次`pushEffect`的参数是不同

- 相同：hookFlags
- 不相同： HookHasEffect | hookFlags

这是为什么呢？

我们都知道，`effect`是保存在一个环状链表中的，这个链表中元素的个数和位置不能发生变换的，如果发生变化就可能导致一些错误出现，所以React为了简化检查，无论什么情况都将`effect`加入到链表中，在执行阶段根据`tag`中是否含有`HookHasEffect`，进行判读是否执行。

### 执行流程

在上面的章节我们讲过，在commit阶段的`commitBeforeMutationEffects`函数中，会调度`effect`

```tsx
if ((flags & Passive) !== NoFlags) {
  // If there are passive effects, schedule a callback to flush at
  // the earliest opportunity.
  if (!rootDoesHavePassiveEffects) {
    rootDoesHavePassiveEffects = true;
    // 调度effect
    scheduleCallback(NormalSchedulerPriority, () => {
      flushPassiveEffects();
      return null;
    });
  }
}
```

而在commit的layout阶段（`commitLifeCycles`）中，将要执行的`effect`加入到数组中，等待执行

```tsx
function schedulePassiveEffects(finishedWork: Fiber) {
  const updateQueue: FunctionComponentUpdateQueue | null = (finishedWork.updateQueue: any);
  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next;
    let effect = firstEffect;
    do {
      const {next, tag} = effect;
      if (
        (tag & HookPassive) !== NoHookEffect &&
        (tag & HookHasEffect) !== NoHookEffect
      ) {
        // 将effect加入到数组中，等待被调度执行
        enqueuePendingPassiveHookEffectUnmount(finishedWork, effect);
        enqueuePendingPassiveHookEffectMount(finishedWork, effect);
      }
      effect = next;
    } while (effect !== firstEffect);
  }
}

export function enqueuePendingPassiveHookEffectMount(
  fiber: Fiber,
  effect: HookEffect,
): void {
  pendingPassiveHookEffectsMount.push(effect, fiber);
  if (!rootDoesHavePassiveEffects) {
    rootDoesHavePassiveEffects = true;
    scheduleCallback(NormalSchedulerPriority, () => {
      flushPassiveEffects();
      return null;
    });
  }
}

export function enqueuePendingPassiveHookEffectUnmount(
  fiber: Fiber,
  effect: HookEffect,
): void {
  pendingPassiveHookEffectsUnmount.push(effect, fiber);
  if (__DEV__) {
    fiber.flags |= PassiveUnmountPendingDev;
    const alternate = fiber.alternate;
    if (alternate !== null) {
      alternate.flags |= PassiveUnmountPendingDev;
    }
  }
  if (!rootDoesHavePassiveEffects) {
    rootDoesHavePassiveEffects = true;
    scheduleCallback(NormalSchedulerPriority, () => {
      flushPassiveEffects();
      return null;
    });
  }
}

```

由代码可以看出，`effect`会被加入到两个数组中，`pendingPassiveHookEffectsUnmount`和`pendingPassiveHookEffectsMount`，这两个数组会在`flushPassiveEffects`被调用。

### flushPassiveEffects

`flushPassiveEffects`函数最终实现为`flushPassiveEffectsImpl`

```tsx
function flushPassiveEffectsImpl() {
    if (rootWithPendingPassiveEffects === null) {
      return false;
    }
  
    const root = rootWithPendingPassiveEffects;
    const lanes = pendingPassiveEffectsLanes;
    rootWithPendingPassiveEffects = null;
    pendingPassiveEffectsLanes = NoLanes;

    if (enableSchedulingProfiler) {
      markPassiveEffectsStarted(lanes);
    }
  
    const prevExecutionContext = executionContext;
    executionContext |= CommitContext;
    const prevInteractions = pushInteractions(root);
  
    // First pass: Destroy stale passive effects.
    // 上次执行的useEffect的销毁函数
    const unmountEffects = pendingPassiveHookEffectsUnmount;
    pendingPassiveHookEffectsUnmount = [];
    for (let i = 0; i < unmountEffects.length; i += 2) {
      const effect = ((unmountEffects[i]: any): HookEffect);
      const fiber = ((unmountEffects[i + 1]: any): Fiber);
      const destroy = effect.destroy;
      effect.destroy = undefined;
  
     
      // 如果destroy不为undefined，执行销毁函数
      if (typeof destroy === 'function') {
          destroy();
      }
    }
    // Second pass: Create new passive effects.
    // 执行本次的useEffect
    const mountEffects = pendingPassiveHookEffectsMount;
    pendingPassiveHookEffectsMount = [];
    for (let i = 0; i < mountEffects.length; i += 2) {
      const effect = ((mountEffects[i]: any): HookEffect);
      const fiber = ((mountEffects[i + 1]: any): Fiber);
      effect.destroy = create();
    }
}
```

我们省略一部分代码，可以看出，此函数主要做两件事：

- 通过`pendingPassiveHookEffectsUnmount`调用`destroy`函数
- 通过`pendingPassiveHookEffectsMount`调用`create`函数

至此`Hooks`章节完成，`concurrent`模式我们在react18后补全。