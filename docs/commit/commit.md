# commit 阶段

上一节我们讲完了render阶段，本章节我们将要进入commit阶段的学习。

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

有上述代码可知，在调用render阶段完成后，获取`workInProgress`的`rootFiber`节点，在

