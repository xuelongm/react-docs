# 捕获阶段
从本章开始我们开始介绍render阶段的详细过程。那么我们先从捕获阶段的入口函数开始。

## beignWork

`beignwork`函数在ReactFiberBeginWork.old.js中，全部函数大概有5，600行，所以我会去掉一些不太重要的部分，我们只关注重要部分。

```javascript
function beginWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  const updateLanes = workInProgress.lanes;
	// 如果current不为空，表示当前阶段为update阶段，会做一些优化
  if(current !== null) {
    // ...省略
  }
  
  workInProgress.lanes = NoLanes;

  switch (workInProgress.tag) {
  	// ...省略
  }
}
```

首先我们来看看参数：

- current：表示上一次更新的节点，也就是当前渲染的节点，如果存在，那么workInProgress.alternate应该指向同一个对象
- workInProgress：当前要更新的fiber
- renderLanes：优先级相关，后面在讲Concurrent模式的时候详细讲

通过上面简化后的代码可以看出，`beignWork`有两个重要逻辑组成，即`if(current !== null)`和`switch`两部。那么这两部分都是用来做什么呢？

## current不为空

在什么情况下current会不为空呢，从`beignWork`的调用处可以看出current=workInProgress.alternate，那么workInProgress.alternate什么情况为空，我们知道，workInProgress.alternate指向挡墙渲染的节点，当前节点已经被挂载的情况下workInProgress.alternate不为空，，由此可见，当current不为空，表示此节点进行的是更新，由此可以得出结论，此判断是为了更新阶段的性能优化。

```javascript
if (current !== null) {
    const oldProps = current.memoizedProps;
    const newProps = workInProgress.pendingProps;
    // 判断当前fiber节点是否有变化，
    if (oldProps !== newProps || hasLegacyContextChanged() ||
      (__DEV__ ? workInProgress.type !== current.type : false)
    ) {
      didReceiveUpdate = true;
    } else if (!includesSomeLane(renderLanes, updateLanes)) { 
      //当前fiber的优先级不包含在当前更新的优先级中，直接复用原有的fiber，不在进行下面更新对比，提高效率
      didReceiveUpdate = false;
      switch (workInProgress.tag) {
          // ...省略
          // 更绝tag不同，对不同的tag进行不同的处理
      }
      // 复用fiber，不在进行更新对比，rootFiber总会总到此分支，因为rootfiber.lanes = 0
      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
    } else {
      // 只存在传统模式的一种特殊情况
      if ((current.flags & ForceUpdateForLegacySuspense) !== NoFlags) {
        didReceiveUpdate = true;
      } else {
        didReceiveUpdate = false;
      }
    }
  } else {
    didReceiveUpdate = false;
  }
```

接下来让我们看看`switch`做了什么

## switch

我们只留下几个重要的case，从代码中我们可看出，`swtch`就是根据不同的tag调用不同的update方法，并返回其子节点。

```javascript
 switch (workInProgress.tag) {
    // ...省略
    case FunctionComponent: {
      const Component = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      const resolvedProps =
        workInProgress.elementType === Component
          ? unresolvedProps
          : resolveDefaultProps(Component, unresolvedProps);
      return updateFunctionComponent(
        current,
        workInProgress,
        Component,
        resolvedProps,
        renderLanes,
      );
    }
    case ClassComponent: {
      const Component = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      const resolvedProps =
        workInProgress.elementType === Component
          ? unresolvedProps
          : resolveDefaultProps(Component, unresolvedProps);
      return updateClassComponent(
        current,
        workInProgress,
        Component,
        resolvedProps,
        renderLanes,
      );
    }
    case HostRoot:
      return updateHostRoot(current, workInProgress, renderLanes);
    case HostComponent:
      return updateHostComponent(current, workInProgress, renderLanes);
   // ...省略
  }
```

那么这些update函数中做什么呢，我们以`updateClassComponent`和`updateClassComponent`为例进行讲解。

## updateClassComponent

- current：当前渲染中的fiber
- workInProgress：workInProgress
- Component：class对象，不是class实例
- nextProps：本次创建使用的props
- renderLanes：本次渲染的优先级

```javascript

function updateClassComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  nextProps: any,
  renderLanes: Lanes,
) {
  // 处理context。暂时可以忽略
  let hasContext;
  if (isLegacyContextProvider(Component)) {
    hasContext = true;
    pushLegacyContextProvider(workInProgress);
  } else {
    hasContext = false;
  }
  prepareToReadContext(workInProgress, renderLanes);
	// 获取Class的instance实例
  const instance = workInProgress.stateNode;
  let shouldUpdate;
   // 如果不存在，则调用new创建Class实例
  if (instance === null) {
    if (current !== null) {
      current.alternate = null;
      workInProgress.alternate = null;
      workInProgress.flags |= Placement;
    }
    constructClassInstance(workInProgress, Component, nextProps);
    mountClassInstance(workInProgress, Component, nextProps, renderLanes);
    shouldUpdate = true;
  } else if (current === null) {
    shouldUpdate = resumeMountClassInstance(
      workInProgress,
      Component,
      nextProps,
      renderLanes,
    );
  } else {
    shouldUpdate = updateClassInstance(
      current,
      workInProgress,
      Component,
      nextProps,
      renderLanes,
    );
  }
  const nextUnitOfWork = finishClassComponent(
    current,
    workInProgress,
    Component,
    shouldUpdate,
    hasContext,
    renderLanes,
  );
  return nextUnitOfWork;
}

```

由此函数名称可以看出这个函数用来更新ClassCompenent的，那么函数中做了什么呢？

- 处理context
- 判断instance（class 实例）是否存在，如果不存在则进行创建，此时会调用`constructClassInstance`函数创建Class的实例，此时Class构造函数`constructor`会被调用
- 挂载或更新（mountClassInstance/updateClassInstance）
- finishClassComponent

那么接下来让我们看看`mountClassInstance`，`updateClassInstance`，`finishClassComponent`这三个函数做了什么。

### mountClassInstance

- 计算出出最新的state
- 调用getDerivedStateFromProps生命周期
- 调用componentWillMount和UNSAFE_componentWillMount生命周期

```javascript
function mountClassInstance(
  workInProgress: Fiber,
  ctor: any,
  newProps: any,
  renderLanes: Lanes,
): void {
	//...省略
  //根据updateQueue计算最新的state  
  processUpdateQueue(workInProgress, newProps, instance, renderLanes);
  instance.state = workInProgress.memoizedState;
 	// 调用getDerivedStateFromProps生命周期
  const getDerivedStateFromProps = ctor.getDerivedStateFromProps;
  if (typeof getDerivedStateFromProps === 'function') {
    applyDerivedStateFromProps(
      workInProgress,
      ctor,
      getDerivedStateFromProps,
      newProps,
    );
    instance.state = workInProgress.memoizedState;
  }
	
  if (
    typeof ctor.getDerivedStateFromProps !== 'function' &&
    typeof instance.getSnapshotBeforeUpdate !== 'function' &&
    (typeof instance.UNSAFE_componentWillMount === 'function' ||
      typeof instance.componentWillMount === 'function')
  ) {
    // 调用componentWillMount和UNSAFE_componentWillMount生命周期
    callComponentWillMount(workInProgress, instance);
    // If we had additional state updates during this life-cycle, let's
    // process them now.
    processUpdateQueue(workInProgress, newProps, instance, renderLanes);
    instance.state = workInProgress.memoizedState;
  }

  if (typeof instance.componentDidMount === 'function') {
    if (__DEV__ && enableDoubleInvokingEffects) {
      workInProgress.flags |= MountLayoutDev | Update;
    } else {
      workInProgress.flags |= Update;
    }
  }
}
```

### updateClassInstance

- 调用UNSAFE_componentWillReceiveProps、componentWillReceiveProps生命周期
- 计算state
- 调用getDerivedStateFromProps生命周期、
- 调用shouldComponentUpdate生命周期
- 调用componentWillUpdate和UNSAFE_componentWillUpdate生命周期

```javascript
function updateClassInstance(
  current: Fiber,
  workInProgress: Fiber,
  ctor: any,
  newProps: any,
  renderLanes: Lanes,
): boolean {
  const instance = workInProgress.stateNode;

  cloneUpdateQueue(current, workInProgress);

  const unresolvedOldProps = workInProgress.memoizedProps;
  const oldProps =
    workInProgress.type === workInProgress.elementType
      ? unresolvedOldProps
      : resolveDefaultProps(workInProgress.type, unresolvedOldProps);
  instance.props = oldProps;
  const unresolvedNewProps = workInProgress.pendingProps;

  const oldContext = instance.context;
  const contextType = ctor.contextType;
  let nextContext = emptyContextObject;
  if (typeof contextType === 'object' && contextType !== null) {
    nextContext = readContext(contextType);
  } else if (!disableLegacyContext) {
    const nextUnmaskedContext = getUnmaskedContext(workInProgress, ctor, true);
    nextContext = getMaskedContext(workInProgress, nextUnmaskedContext);
  }
  const getDerivedStateFromProps = ctor.getDerivedStateFromProps;
  const hasNewLifecycles =
    typeof getDerivedStateFromProps === 'function' ||
    typeof instance.getSnapshotBeforeUpdate === 'function';
   // 调用UNSAFE_componentWillReceiveProps、componentWillReceiveProps生命周期
  if (
    !hasNewLifecycles &&
    (typeof instance.UNSAFE_componentWillReceiveProps === 'function' ||
      typeof instance.componentWillReceiveProps === 'function')
  ) {
    if (
      unresolvedOldProps !== unresolvedNewProps ||
      oldContext !== nextContext
    ) {
      callComponentWillReceiveProps(
        workInProgress,
        instance,
        newProps,
        nextContext,
      );
    }
  }

  resetHasForceUpdateBeforeProcessing();

  const oldState = workInProgress.memoizedState;
  let newState = (instance.state = oldState);
  // 计算state
  processUpdateQueue(workInProgress, newProps, instance, renderLanes);
  newState = workInProgress.memoizedState;
	// 判断是否更新的
  if (
    unresolvedOldProps === unresolvedNewProps &&
    oldState === newState &&
    !hasContextChanged() &&
    !checkHasForceUpdateAfterProcessing()
  ) {
    // If an update was already in progress, we should schedule an Update
    // effect even though we're bailing out, so that cWU/cDU are called.
    if (typeof instance.componentDidUpdate === 'function') {
      if (
        unresolvedOldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.flags |= Update;
      }
    }
    if (typeof instance.getSnapshotBeforeUpdate === 'function') {
      if (
        unresolvedOldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.flags |= Snapshot;
      }
    }
    return false;
  }
	// 调用getDerivedStateFromProps生命周期
  if (typeof getDerivedStateFromProps === 'function') {
    applyDerivedStateFromProps(
      workInProgress,
      ctor,
      getDerivedStateFromProps,
      newProps,
    );
    newState = workInProgress.memoizedState;
  }
	// 调用shouldComponentUpdate生命周期
  // 判断isPureReactComponent是否为真
  const shouldUpdate =
    checkHasForceUpdateAfterProcessing() ||
    checkShouldComponentUpdate(
      workInProgress,
      ctor,
      oldProps,
      newProps,
      oldState,
      newState,
      nextContext,
    );

  if (shouldUpdate) {
    // In order to support react-lifecycles-compat polyfilled components,
    // Unsafe lifecycles should not be invoked for components using the new APIs.
    if (
      !hasNewLifecycles &&
      (typeof instance.UNSAFE_componentWillUpdate === 'function' ||
        typeof instance.componentWillUpdate === 'function')
    ) {
      if (typeof instance.componentWillUpdate === 'function') {
        // 调用componentWillUpdate
        instance.componentWillUpdate(newProps, newState, nextContext);
      }
      if (typeof instance.UNSAFE_componentWillUpdate === 'function') {
        // 调用UNSAFE_componentWillUpdate生命周期
        instance.UNSAFE_componentWillUpdate(newProps, newState, nextContext);
      }
    }
    if (typeof instance.componentDidUpdate === 'function') {
      workInProgress.flags |= Update;
    }
    if (typeof instance.getSnapshotBeforeUpdate === 'function') {
      workInProgress.flags |= Snapshot;
    }
  } else {
    // If an update was already in progress, we should schedule an Update
    // effect even though we're bailing out, so that cWU/cDU are called.
    if (typeof instance.componentDidUpdate === 'function') {
      if (
        unresolvedOldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.flags |= Update;
      }
    }
    if (typeof instance.getSnapshotBeforeUpdate === 'function') {
      if (
        unresolvedOldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.flags |= Snapshot;
      }
    }

    // If shouldComponentUpdate returned false, we should still update the
    // memoized props/state to indicate that this work can be reused.
    workInProgress.memoizedProps = newProps;
    workInProgress.memoizedState = newState;
  }

  // Update the existing instance's state, props, and context pointers even
  // if shouldComponentUpdate returns false.
  instance.props = newProps;
  instance.state = newState;
  instance.context = nextContext;

  return shouldUpdate;
}
```

