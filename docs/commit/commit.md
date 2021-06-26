# commit 阶段

上一节我们讲完了render阶段，本章节我们将要进入commit阶段的学习。

在进入章节之前要牢记几件事：

- 用于副作用的effectList单项链表已形成，`rootFiber.firstEffect`指向当前要更新的第一个节点
- 用于`mount`的dom创建
- 

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
      // 调用生命周期，调用useLayoutEffect，讲useEffect放入到数组中，绑定ref
      commitLayoutEffects(root, lanes);å
    } while (nextEffect !== null);
  
    //...省略代码
  
    return null;
}
```

## beforeMutation

- 处理blur和focus相关逻辑
- 对于class component类型，如果有`Snapshot`，会在`commitBeforeMutationEffectOnFiber`中调用`getSnapshotBeforeUpdate`

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









