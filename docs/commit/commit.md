# commit 阶段

上一节我们讲完了render阶段，本章节我们将要进入commit阶段的学习。

> 本系列文章的使用react版本为17.0.2，后期版本这块的代码可能变化比较大

在进入章节之前要牢记几件事：

- 用于副作用的effectList单项链表已形成，`rootFiber.firstEffect`指向当前要更新的第一个节点
- 此阶段为同步更新，不可被打断
- commit也是通过runWithPriority调度起来的，只是调度的同步任务而已

commit阶段的入口函数是`commitRoot()`，此函数在`performSyncWorkOnRoot()`和`finishConcurrentRender()`函数中调用。在commit阶段是同步执行的，不可以被打断，也就是说所有的更新需要一次性完成。

我们以`performSyncWorkOnRoot()`为例，看看`commitRoot()`的调用：

```tsx
function performSyncWorkOnRoot(root) {

    // ...省略大部分代码
    // render阶段的入口函数
    exitStatus = renderRootSync(root, lanes);
    // ...省略代码
    // commitRoot函数调用
    const finishedWork: Fiber = (root.current.alternate: any);
    root.finishedWork = finishedWork;
    root.finishedLanes = lanes;
    commitRoot(root);
    // ...省略代码
}
```

有上述代码可知，在调用render阶段完成后，获取`workInProgress`的`rootFiber`节点，并将`rootFiber`节点传入`commitRoot`中。现在就让我们揭开`commitRoot`的神秘面纱。

😭，commitRoot代码就5行，只是用`runWithPriority`调起一个任务，也就是说所有的逻辑都是在`commitRootImpl`函数中

```tsx
function commitRoot(root) {
    const renderPriorityLevel = getCurrentPriorityLevel();
    runWithPriority(
      ImmediateSchedulerPriority,
      commitRootImpl.bind(null, root, renderPriorityLevel),
    );
    return null;
}
```

`commitRootImpl`函数全部代码有371行，看这么长的代码就是一种折磨，不过我们可以只关注代码中最主要的功能就好，主要有以下几个功能：

- 处理rootFiber节点，将rootFiber节点加入到effectList中
- 调用`commitBeforeMutationEffects`函数（before mutation）
- 调用`commitMutationEffects`函数（mutation）
- 调用`commitLayoutEffects`函数（layout）

那么这个三个函数有做了写什么呢？下面我们一一分析

```tsx
function commitRootImpl(root, renderPriorityLevel) {
    // ...省略代码

    // 获取effectList
    let firstEffect;
    if (finishedWork.flags > PerformedWork) {
      // 因为rootFiber在render阶段不会加入到链表，此时我们要把rootFiber节点加入到链表中
      if (finishedWork.lastEffect !== null) {
        finishedWork.lastEffect.nextEffect = finishedWork;
        firstEffect = finishedWork.firstEffect;
      } else {
        firstEffect = finishedWork;
      }
    } else {
      // There is no effect on the root.
      firstEffect = finishedWork.firstEffect;
    }

    // ...省略代码
    // 操作DOM之前的操作
    nextEffect = firstEffect;
    do {
      // 会调用getSnxapshotBeforeUpdate函数
      commitBeforeMutationEffects();
    } while (nextEffect !== null);

    // We no longer need to track the active instance fiber
    focusedInstanceHandle = null;

    if (enableProfilerTimer) {
      // Mark the current commit time to be shared by all Profilers in this
      // batch. This enables them to be grouped later.
      recordCommitTime();
    }

    // The next phase is the mutation phase, where we mutate the host tree.
    // 此阶段会修改DOM
    nextEffect = firstEffect;
    do {
      // 解绑ref，调用useLayoutEffect销毁函数, 调用DOM操作
      commitMutationEffects(root, renderPriorityLevel);
    } while (nextEffect !== null);

    // ...省略代码
    // 将workProgress 赋值到当前的current
    // 此处很重要
    root.current = finishedWork;

    // 操作DOM树
    nextEffect = firstEffect;
    do {
      // 调用生命周期，调用useLayoutEffect，将useEffect放入到数组中，绑定ref
      commitLayoutEffects(root, lanes);å
    } while (nextEffect !== null);
  
    //...省略代码
  
    return null;
}
```

## beforeMutation

- 处理blur和focus相关逻辑
- 对于class component类型，如果有`Snapshot`，会在`commitBeforeMutationEffectOnFiber`中调用`getSnapshotBeforeUpdate`
- 调度useEffect（在此处只是将useEffect调度起来，并不会真正的执行）

```tsx
function commitBeforeMutationEffects() {
  while (nextEffect !== null) {
    const current = nextEffect.alternate;

    if (!shouldFireAfterActiveInstanceBlur && focusedInstanceHandle !== null) {
     ]// 处理blur和focus相关逻辑
    }

    const flags = nextEffect.flags;
    if ((flags & Snapshot) !== NoFlags) {
      setCurrentDebugFiberInDEV(nextEffect);
      // 如果current 为ClassComponent 则会调用getSnapshotBeforeUpdate
      commitBeforeMutationEffectOnFiber(current, nextEffect);

      resetCurrentDebugFiberInDEV();
    }
    if ((flags & Passive) !== NoFlags) {
      // 调度effect
      if (!rootDoesHavePassiveEffects) {
        rootDoesHavePassiveEffects = true;
        scheduleCallback(NormalSchedulerPriority, () => {
          flushPassiveEffects();
          return null;
        });
      }
    }
    nextEffect = nextEffect.nextEffect;
  }
}
```

### `getSnapshotBeforeUpdate`调用

我们知道在React16后，componentWillxxx生命周期都加上了`UNSAFE_`前缀。这是因为这些生命周期都是在render阶段调用的，而在concurrent模式下render阶段可以被打断和重新调用，也就会导致这些方法多次的调用。

而`getSnapshotBeforeUpdate`是在commit阶段调用的，commit阶段是同步执行的，所以不会出现多次调用的情况。

如果在Class Compenent中添加了`getSnapshotBeforeUpdate`函数，再添加`UNSAFE_componentWillMount/componentWillMount`，`UNSAFE_componentWillReceiveProps/componentWillReceiveProps`和`UNSAFE_componentWillUpdate/componentWillUpdate`都不会在被调用

```tsx
const hasNewLifecycles =
    typeof getDerivedStateFromProps === 'function' ||
    typeof instance.getSnapshotBeforeUpdate === 'function';

 if (
      !hasNewLifecycles &&
      (typeof instance.UNSAFE_componentWillUpdate === 'function' ||
        typeof instance.componentWillUpdate === 'function')
    ) {
      if (typeof instance.componentWillUpdate === 'function') {
        instance.componentWillUpdate(newProps, newState, nextContext);
      }
      if (typeof instance.UNSAFE_componentWillUpdate === 'function') {
        instance.UNSAFE_componentWillUpdate(newProps, newState, nextContext);
      }
    }
```

总而言之，`getSnapshotBeforeUpdate`是为了解决异步调用过程中的多次调用问题，我们在代码中应该尽量使用`getSnapshotBeforeUpdate`来代替原来的生命周期。

### 调度useEffect

在beforeMutitation阶段，会将useEffect加入到调度任务中，详细解析会在后面讲解useEffect时详细讲解。

```tsx
 // 调度effect
if (!rootDoesHavePassiveEffects) {
  rootDoesHavePassiveEffects = true;
  // 异步调度useEffect
  scheduleCallback(NormalSchedulerPriority, () => {
    flushPassiveEffects();
    return null;
  });
}
```

那么React为什么会异步调度useEffect呢？

与 `componentDidMount`、`componentDidUpdate` 不同的是，传给 `useEffect` 的函数会在浏览器完成布局与绘制**之后**，在一个延迟事件中被调用。这使得它适用于许多常见的副作用场景，比如设置订阅和事件处理等情况，因为绝大多数操作不应阻塞浏览器对屏幕的更新。

然而，并非所有 effect 都可以被延迟执行。例如，一个对用户可见的 DOM 变更就必须在浏览器执行下一次绘制前被同步执行，这样用户才不会感觉到视觉上的不一致。（概念上类似于被动监听事件和主动监听事件的区别。）React 为此提供了一个额外的 [`useLayoutEffect`](https://zh-hans.reactjs.org/docs/hooks-reference.html#uselayouteffect) Hook 来处理这类 effect。它和 `useEffect` 的结构相同，区别只是调用时机不同。

虽然 `useEffect` 会在浏览器绘制后延迟执行，但会保证在任何新的渲染前执行。在开始新的更新前，React 总会先清除上一轮渲染的 effect。

> [以上来自官网](https://zh-hans.reactjs.org/docs/hooks-reference.html#timing-of-effects)

### 总结

在beforeMutation阶段会做三件事：

- 处理blur和focus DOM节点
- 调度`getSnapshotBeforeUpdate`生命周期
- 调度useEffect（注意是调度，不是调用）

## Mutation阶段

mutation阶段的入口是`commitMutationEffects` 

```tsx
nextEffect = firstEffect;
do {
  // mutation阶段的入口函数
  commitMutationEffects(root, renderPriorityLevel);
} while (nextEffect !== null);
```

`commitMutationEffects`函数如下：

```tsx
function commitMutationEffects(
root: FiberRoot,
 renderPriorityLevel: ReactPriorityLevel,
) {
  while (nextEffect !== null) {
    setCurrentDebugFiberInDEV(nextEffect);

    const flags = nextEffect.flags;

    if (flags & ContentReset) {
      commitResetTextContent(nextEffect);
    }

    if (flags & Ref) {
      const current = nextEffect.alternate;
      if (current !== null) {
        // 解绑ref
        commitDetachRef(current);
      }
      if (enableScopeAPI) {
        // 下面是临时方案，可以忽略
        if (nextEffect.tag === ScopeComponent) {
          commitAttachRef(nextEffect);
        }
      }
    }

    const primaryFlags = flags & (Placement | Update | Deletion | Hydrating);
    switch (primaryFlags) {
      // 插入节点
      case Placement: {
        commitPlacement(nextEffect);
        nextEffect.flags &= ~Placement;
        break;
      }
			// 插入并更新节点
      case PlacementAndUpdate: {
        commitPlacement(nextEffect);
        nextEffect.flags &= ~Placement;

        // Update
        const current = nextEffect.alternate;
        commitWork(current, nextEffect);
        break;
      }
      // 服务端渲染 ssr
      case Hydrating: {
        nextEffect.flags &= ~Hydrating;
        break;
      }
      // 服务端渲染
      case HydratingAndUpdate: {
        nextEffect.flags &= ~Hydrating;

        // Update
        const current = nextEffect.alternate;
        commitWork(current, nextEffect);
        break;
      }
      // 更新
      case Update: {
        const current = nextEffect.alternate;
        commitWork(current, nextEffect);
        break;
      }
      // 删除
      case Deletion: {
        commitDeletion(root, nextEffect, renderPriorityLevel);
        break;
      }
    }

    resetCurrentDebugFiberInDEV();
    nextEffect = nextEffect.nextEffect;
  }
}
```

`commitMutationEffects`遍历全部的effectList，对每个节点做如下处理（忽略SSR相关）

- 重置text
- 解绑ref
- 根据Fiber节点的`flag`类型，决定对DOM节点要做的操作，包括增删改

### 增（Placement）

**增**的入口为`commitPlacement`，`commitPlacement`代码大致如下：

```tsx
function commitPlacement(finishedWork: Fiber): void {
  	// 当前环境支持Mutation
    if (!supportsMutation) {
      return;
    }

  	// 获取有DOM节点的parent节点，tag类型包括HostComponent，HostRoot，HostPortal，FundamentalComponent
    const parentFiber = getHostParentFiber(finishedWork);
		// DOM Parent
    let parent;
  	// 是否为root container
    let isContainer;
    const parentStateNode = parentFiber.stateNode;
    switch (parentFiber.tag) {
      case HostComponent:
        parent = parentStateNode;
        isContainer = false;
        break;
      case HostRoot:
        parent = parentStateNode.containerInfo;
        isContainer = true;
        break;
      case HostPortal:
        parent = parentStateNode.containerInfo;
        isContainer = true;
        break;
      case FundamentalComponent:
        if (enableFundamentalAPI) {
          parent = parentStateNode.instance;
          isContainer = false;
        }
        // eslint-disable-next-line-no-fallthrough
      default:
        invariant(
          false,
          'Invalid host parent fiber. This error is likely caused by a bug ' +
          'in React. Please file an issue.',
        );
    }
    if (parentFiber.flags & ContentReset) {
      // 重置textContent
      resetTextContent(parent);
      // Clear ContentReset from the effect tag
      parentFiber.flags &= ~ContentReset;
    }

  	// 获取当前节点的兄弟节点
    const before = getHostSibling(finishedWork);
  
 		// 插入节点
    if (isContainer) {
      insertOrAppendPlacementNodeIntoContainer(finishedWork, before, parent);
    } else {
      insertOrAppendPlacementNode(finishedWork, before, parent);
    }
}
```

`commitPlacement`主要完成一下几件事：

- 获取有DOM节点的Fiber节点，入口函数为`getHostParentFiber`
- 获取Parent DOM节点
- 获取当前节点的DOM节点的兄弟DOM节点，入口函数为`getHostSibling`
- 插入节点，入口函数为`insertOrAppendPlacementNodeIntoContainer`和`insertOrAppendPlacementNode`

以上几件事最主要的是获取兄弟节点和插入节点。

#### getHostSibling

`getHostSibling`获取兄弟DOM节点是很有意思的算法，因为Fiber节点不止包括`HostComponent`节点，还包括`ClassComponent`等节点，也就是DOM节点和Fiber节点不是同级的。如下面的例子：

```tsx
function Test() {
  return (
    <div>1212</div>
  )
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isShow: false,
    }
  }

  updateCount() {
    this.setState({isShow: !this.state.isShow});
  }

  render() {
    const pNode = this.state.isShow ? <p>test</p> : null;
    return (
      <div>
        {pNode}
        <Test></Test>
        <button onClick={() => this.updateCount()}>click me</button>
      </div>
    )
  }
}
```

Fiber节点如下：

- this.state.isShow === false

Fiber 树

<br>

<img src='../../assets/graph1.jpg'>

</br>

DOM树

<br>

<img src='../../assets/graph2.jpg'>

</br>

- this.state.isShow === ture

Fiber 树
<br>

<img src='../../assets/graph3.jpg'>

</br>
DOM树

<br>

<img src='../../assets/graph4.jpg'>

</br>

如上，P的兄弟节点，在DOM树上和Fiber树上是 不同级，在DOM书上，P的兄弟节点是TESTDIV，在Fiber树上P的兄弟节点是TEST。如果我们想找到P的兄弟DOM节点需要跨级寻找，树的跨级寻找的复杂度都是很高的。所以循环插入DOM可能会有性能问题。

下面让我们来看看`getHostSibling`算法的实现：

```ts
function getHostSibling(fiber: Fiber): ?Instance {
  let node: Fiber = fiber;
  siblings: while (true) {
    // 如果当前节点没有兄弟节点，则去查询父节点
    while (node.sibling === null) {
      if (node.return === null || isHostParent(node.return)) {
        return null;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
    while (
      node.tag !== HostComponent &&
      node.tag !== HostText &&
      node.tag !== DehydratedFragment
    ) {
      if (node.flags & Placement) {
        continue siblings;
      }
      if (node.child === null || node.tag === HostPortal) {
        continue siblings;
      } else {
        // 查找兄弟节点的子节点
        node.child.return = node;
        node = node.child;
      }
    }
    if (!(node.flags & Placement)) {
      return node.stateNode;
    }
  }
}
```

#### 插入节点

插入DOM节点的入口是`insertOrAppendPlacementNodeIntoContainer`和`insertOrAppendPlacementNode`，这两个函数最终都会调用到真实DOM的`insertBefore`或函数`appendChild`。我们以`insertOrAppendPlacementNode`进行分析：

```ts
function insertOrAppendPlacementNode(
  node: Fiber,
  before: ?Instance,
  parent: Instance,
): void {
  const {tag} = node;
  const isHost = tag === HostComponent || tag === HostText;
  if (isHost || (enableFundamentalAPI && tag === FundamentalComponent)) {
    // 如果tag为HostCompponent或HostText类型，直接将DOM插入就好
    const stateNode = isHost ? node.stateNode : node.stateNode.instance;
    if (before) {
      insertBefore(parent, stateNode, before);
    } else {
      appendChild(parent, stateNode);
    }
  } else if (tag === HostPortal) {
    // 什么都不做
  } else {
    // 当Tag不为以上情况下，需要递归插入
    const child = node.child;
    if (child !== null) {
      insertOrAppendPlacementNode(child, before, parent);
      let sibling = child.sibling;
      while (sibling !== null) {
        insertOrAppendPlacementNode(sibling, before, parent);
        sibling = sibling.sibling;
      }
    }
  }
}
```

我们来分析下`else`的情况：

```jsx
function Test() {
  return (
    <p>test</p>
    <div>1212</div>
  )
}

function App() {
	const [isShow, setIsShow] = useState(false);
  const setIsShowHandler = useCallback(() => setIsShow(true), []);
  const testNode = isShow ? <Test></Test> : null
  return (
    <div>
      {testNode}
      <button onClick={setIsShowHandler}>click me</button>
    </div>
  )
}
```

当我们点击按钮时，会形成这样的EffectList，App.firstEffect --> Test   Test.nextEffect === null，也就是说在EffectList中只有Test Fiber加入到了EffectList中，同时Test Fiber的`flags `含有`Placement`标记，此时要循环将`p`节点和`div`节点插入到DOM中。

### 删除（Deletion）

删除逻辑的入口为`commitDeletion`，`commitDeletion`函数会调用`unmountHostComponents`，并最终在`unmountHostComponents`函数中完成删除逻辑，`unmountHostComponents`函数代码如下：

```tsx
function unmountHostComponents(
finishedRoot: FiberRoot,
 current: Fiber,
 renderPriorityLevel: ReactPriorityLevel,
): void {
  // We only have the top Fiber that was deleted but we need to recurse down its
  // children to find all the terminal nodes.
  let node: Fiber = current;

  // Each iteration, currentParent is populated with node's host parent if not
  // currentParentIsValid.
  let currentParentIsValid = false;

  // Note: these two variables *must* always be updated together.
  let currentParent;
  let currentParentIsContainer;

  while (true) {
    if (!currentParentIsValid) {
      let parent = node.return;
      // 获取真实dom container
      findParent: while (true) {
        const parentStateNode = parent.stateNode;
        switch (parent.tag) {
          case HostComponent:
            currentParent = parentStateNode;
            currentParentIsContainer = false;
            break findParent;
          case HostRoot:
            currentParent = parentStateNode.containerInfo;
            currentParentIsContainer = true;
            break findParent;
          case HostPortal:
            currentParent = parentStateNode.containerInfo;
            currentParentIsContainer = true;
            break findParent;
          case FundamentalComponent:
            if (enableFundamentalAPI) {
              currentParent = parentStateNode.instance;
              currentParentIsContainer = false;
            }
        }
        parent = parent.return;
      }
      currentParentIsValid = true;
    }
		// HostComponent || HostText
    if (node.tag === HostComponent || node.tag === HostText) {
      commitNestedUnmounts(finishedRoot, node, renderPriorityLevel);
      // After all the children have unmounted, it is now safe to remove the
      // node from the tree.
      if (currentParentIsContainer) {
        removeChildFromContainer(
          ((currentParent: any): Container),
          (node.stateNode: Instance | TextInstance),
        );
      } else {
        removeChild(
          ((currentParent: any): Instance),
          (node.stateNode: Instance | TextInstance),
        );
      }
      // Don't visit children because we already visited them.
    } 
    // ...省略其其余类型
    } else {
      // class Component
      commitUnmount(finishedRoot, node, renderPriorityLevel);
      // Visit children because we may find more host components below.
      if (node.child !== null) {
        node.child.return = node;
        node = node.child;
        continue;
      }
    }
    if (node === current) {
      return;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === current) {
        return;
      }
      node = node.return;
      if (node.tag === HostPortal) {
        currentParentIsValid = false;
      }
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}
```

`unmountHostComponents`函数主要完成以下几件事：

- 根据当前节点获取真实的父DOM节点（真实DOM节点和Fiber节点是夸层级的）
- 根据不同的同的tag，调用不同的函数
- 循环递归删除子节点

我们以`HostComponent`/`HostText`和`ClassComponent`为例说明：

- `HostComponent`/`HostText`还是`ClassComponent`节点类型都会调用`commitUnmount`函数
- `HostComponent`/`HostText`调用完`commitUnmount`函数后，在调用`removeChild`函数真实的删除DOM节点

下面我们来看看`commitUnmount`函数做什么了？

```tsx
function commitUnmount(
  finishedRoot: FiberRoot,
  current: Fiber,
  renderPriorityLevel: ReactPriorityLevel,
): void {
  onCommitUnmount(current);
	// 根据不同tag，调用不同的方法
  switch (current.tag) {
    case FunctionComponent:
    case ForwardRef:
    case MemoComponent:
    case SimpleMemoComponent:
    case Block: {
      const updateQueue: FunctionComponentUpdateQueue | null = (current.updateQueue: any);
      if (updateQueue !== null) {
        // 调用useEffect的销毁函数
        const lastEffect = updateQueue.lastEffect;
        if (lastEffect !== null) {
          const firstEffect = lastEffect.next;

          let effect = firstEffect;
          do {
            const {destroy, tag} = effect;
            if (destroy !== undefined) {
              if ((tag & HookPassive) !== NoHookEffect) {
                enqueuePendingPassiveHookEffectUnmount(current, effect);
              } else {
                if (
                  enableProfilerTimer &&
                  enableProfilerCommitHooks &&
                  current.mode & ProfileMode
                ) {
                  startLayoutEffectTimer();
                  safelyCallDestroy(current, destroy);
                  recordLayoutEffectDuration(current);
                } else {
                  safelyCallDestroy(current, destroy);
                }
              }
            }
            effect = effect.next;
          } while (effect !== firstEffect);
        }
      }
      return;
    }
    case ClassComponent: {
     	// 接触ref
      safelyDetachRef(current);
      const instance = current.stateNode;
      if (typeof instance.componentWillUnmount === 'function') {
        // 调用WillUnmount生命周期
        safelyCallComponentWillUnmount(current, instance);
      }
      return;
    }
    case HostComponent: {
      // 解除ref
      safelyDetachRef(current);
      return;
    }
    
}
```

从上面的代码我们可以看出`commitUnmount`主要做一下几件事：

- 调用useEffect的destroy函数
- 调用willUnmount生命周期
- 解除ref的绑定

### 改（commitWork）

**改**的入口函数为`commitWork`，`commitWork`函数代码如下：

```tsx
function commitWork(current: Fiber | null, finishedWork: Fiber): void {
  if (!supportsMutation) {
    // ...省略代码
    // 当前情况表示不支持supportsMutation的情况
  }

  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case MemoComponent:
    case SimpleMemoComponent:
    case Block: {
      if (
        enableProfilerTimer &&
        enableProfilerCommitHooks &&
        finishedWork.mode & ProfileMode
      ) {
        try {
          startLayoutEffectTimer();
          // 执行useLayout的销毁函数
          commitHookEffectListUnmount(HookLayout | HookHasEffect, finishedWork);
        } finally {
          recordLayoutEffectDuration(finishedWork);
        }
      } else {
        commitHookEffectListUnmount(HookLayout | HookHasEffect, finishedWork);
      }
      return;
    }
    case ClassComponent: {
      return;
    }
    case HostComponent: {
      const instance: Instance = finishedWork.stateNode;
      if (instance != null) {
        const newProps = finishedWork.memoizedProps;
        const oldProps = current !== null ? current.memoizedProps : newProps;
        const type = finishedWork.type;
        const updatePayload: null | UpdatePayload = (finishedWork.updateQueue: any);
        finishedWork.updateQueue = null;
        if (updatePayload !== null) {
          commitUpdate(
            instance,
            updatePayload,
            type,
            oldProps,
            newProps,
            finishedWork,
          );
        }
      }
      return;
    }
    // ....省略的一些case
}
```

`commitWork`函数大概有200多行代码，我们省略一些代码，主要关心`fiber.tag`为Function Component和HostCoponent的情况：

在Function Component的情况下，会调用`commitHookEffectListUnmount`函数，此函数主要是为了处理useLayout的销毁函数。

```tsx
useLayout(() => {
	return () => dosomething()
})
```

而HostComponent会调用`commitUpdate`函数，`commitUpdate`函数最终会调用`updateDOMProperties`函数进行真实DOM元素属性替换。

```tsx
function updateDOMProperties(
  domElement: Element,
  updatePayload: Array<any>,
  wasCustomComponentTag: boolean,
  isCustomComponentTag: boolean,
): void {
  // 奇数为key 偶数为value
  for (let i = 0; i < updatePayload.length; i += 2) {
    const propKey = updatePayload[i];
    const propValue = updatePayload[i + 1];
    // 处理style
    if (propKey === STYLE) {
      setValueForStyles(domElement, propValue);
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
      setInnerHTML(domElement, propValue);
    } else if (propKey === CHILDREN) { // 处理child
      setTextContent(domElement, propValue);
    } else {
      // 处理剩余props
      setValueForProperty(domElement, propKey, propValue, isCustomComponentTag);
    }
  }
}
```

> 注：HostComponent的`updatePayload`类型为数组，数组为[key,value,key,value....]的格式

### 总结

Mutation阶段主要做一下几件事：

- 根据`effectList`对`fiber`进行增删改
- 解绑ref
- 对`fiber`进行删除时，解绑ref，调用willUnmount生命周期
- 调用useLayout的销毁函数

## current 切换

在进行下一阶段（layout）之前，先要完成一件事，就是current树的切换

```tex
// 将current切换为workInprogress树
root.current = finishedWork;
```

为什么要在只此时切换current树呢，因为在这个阶段开始之前，所有的DOM已完成渲染，生命周期钩子已经可以访问真实的DOM了，如果不切换，钩子中访问的DOM是上一次渲染的DOM，引起数据错误。

## Layout阶段

此阶段开始之前真实DOM已渲染完成，current树的切换也已完成，在此阶段所有的生命周期钩子都可以方位真实DOM，且能保证数据的正确行。

Layout阶段的入口函数为：`commitLayoutEffects`，此函数主要就是调用useLayoutEffect，将useEffect放入到数组中，绑定ref。

```tsx
root.current = finishedWork;
nextEffect = firstEffect;
do {
  try {
    // 调用生命周期，调用useLayoutEffect，将useEffect放入到数组中，绑定ref
    commitLayoutEffects(root, lanes);
  } catch (error) {
  }
}
} while (nextEffect !== null);
```

### commitLayoutEffects

```tsx
function commitLayoutEffects(root: FiberRoot, committedLanes: Lanes) {
  while (nextEffect !== null) {
    // 调用useLayoutEffect，将useEffect
    setCurrentDebugFiberInDEV(nextEffect);

    const flags = nextEffect.flags;

    if (flags & (Update | Callback)) {
      const current = nextEffect.alternate;
      commitLayoutEffectOnFiber(root, current, nextEffect, committedLanes);
    }

    if (enableScopeAPI) {
      if (flags & Ref && nextEffect.tag !== ScopeComponent) {
        commitAttachRef(nextEffect);
      }
    } else {
      if (flags & Ref) {
        commitAttachRef(nextEffect);
      }
    }

    resetCurrentDebugFiberInDEV();
    nextEffect = nextEffect.nextEffect;
  }
}
```

在`commitLayoutEffects`函数中主要调用了`commitLayoutEffectOnFiber`函数和`commitAttachRef`函数，从名字中我们可以才到，`commitLayoutEffectOnFiber`主要和useLayoutEffect相关，而`commitAttachRef`主要和ref相关。

那么我们就来看看这两个函数实现：

### commitLayoutEffectOnFiber

>  commitLayoutEffectOnFiber函数为commitLifeCycles的别名

```tsx
function commitLifeCycles(
  finishedRoot: FiberRoot,
  current: Fiber | null,
  finishedWork: Fiber,
  committedLanes: Lanes,
): void {
  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case SimpleMemoComponent:
    case Block: {
      if (
        enableProfilerTimer &&
        enableProfilerCommitHooks &&
        finishedWork.mode & ProfileMode
      ) {
        try {
          startLayoutEffectTimer();
          commitHookEffectListMount(HookLayout | HookHasEffect, finishedWork);
        } finally {
          recordLayoutEffectDuration(finishedWork);
        }
      } else {
        // 执行LayouHook
        commitHookEffectListMount(HookLayout | HookHasEffect, finishedWork);
      }
      // 调度起useEffect
      schedulePassiveEffects(finishedWork);
      return;
    }
    // 调用生命周期
    case ClassComponent: {
      const instance = finishedWork.stateNode;
      if (finishedWork.flags & Update) {
        if (current === null) {
          if (
            enableProfilerTimer &&
            enableProfilerCommitHooks &&
            finishedWork.mode & ProfileMode
          ) {
            try {
              startLayoutEffectTimer();
              instance.componentDidMount();
            } finally {
              recordLayoutEffectDuration(finishedWork);
            }
          } else {
            instance.componentDidMount();
          }
        } else {
          const prevProps =
            finishedWork.elementType === finishedWork.type
              ? current.memoizedProps
              : resolveDefaultProps(finishedWork.type, current.memoizedProps);
          const prevState = current.memoizedState;
          if (
            enableProfilerTimer &&
            enableProfilerCommitHooks &&
            finishedWork.mode & ProfileMode
          ) {
            try {
              startLayoutEffectTimer();
              instance.componentDidUpdate(
                prevProps,
                prevState,
                instance.__reactInternalSnapshotBeforeUpdate,
              );
            } finally {
              recordLayoutEffectDuration(finishedWork);
            }
          } else {
            instance.componentDidUpdate(
              prevProps,
              prevState,
              instance.__reactInternalSnapshotBeforeUpdate,
            );
          }
        }
      }
      const updateQueue: UpdateQueue<
        *,
      > | null = (finishedWork.updateQueue: any);
      if (updateQueue !== null) {
        commitUpdateQueue(finishedWork, updateQueue, instance);
      }
      return;
    }
    //...省略一些case
  }
}
```

我们省略一部分代码，主要关注ClassComponent和FunctionComponent两种情况，可以看出在`commitLifeCycles`中主要是对effect和生命周期的处理，处理ClassComponent时会调用`componentDidUpdate`/`componentDidMount`的生命周期，而FunctionComponent则主要是调用`commitHookEffectListMount`函数来处理useLayouEffect，最后调用`schedulePassiveEffects`将useEffect调度起来。

可能细心的同学发现，在ClassComponent结尾会调用`commitUpdateQueue`函数，那么这函数是做什么的呢？

这个函数是处理setState回调函数的：

```tsx
setState({count: 1321}, () => {
  // 此处为对调函数
});

export function commitUpdateQueue<State>(
  finishedWork: Fiber,
  finishedQueue: UpdateQueue<State>,
  instance: any,
): void {
  // Commit the effects
  const effects = finishedQueue.effects;
  finishedQueue.effects = null;
  if (effects !== null) {
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      const callback = effect.callback;
     	// 调用回调函数
      if (callback !== null) {
        effect.callback = null;
        callCallback(callback, instance);
      }
    }
  }
}
```



### commitAttachRef

```tsx
function commitAttachRef(finishedWork: Fiber) {
  const ref = finishedWork.ref;
  if (ref !== null) {
    const instance = finishedWork.stateNode;
    let instanceToUse;
    // 获取DOM
    switch (finishedWork.tag) {
      case HostComponent:
        instanceToUse = getPublicInstance(instance);
        break;
      default:
        instanceToUse = instance;
    }
    if (enableScopeAPI && finishedWork.tag === ScopeComponent) {
      instanceToUse = instance;
    }
    // 将DOM赋值给ref
    if (typeof ref === 'function') {
      // 如果ref是函数形式，则调用hansh
      ref(instanceToUse);
    } else {
      // 如果ref是ref，则直接赋值
      ref.current = instanceToUse;
    }
  }
}
```

## 总结

至此我们学完了整个commit阶段，commit阶段最主要的内容就是通过三个while循环执行effectList，在不同的阶段处理不同的内容。此阶段都是同步进行的，不能被打断。

下一章我们将来讲解React中的diff算法。
