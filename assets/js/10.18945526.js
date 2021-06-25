(window.webpackJsonp=window.webpackJsonp||[]).push([[10],{379:function(t,s,n){"use strict";n.r(s);var a=n(26),o=Object(a.a)({},(function(){var t=this,s=t.$createElement,n=t._self._c||s;return n("ContentSlotsDistributor",{attrs:{"slot-key":t.$parent.slotKey}},[n("h1",{attrs:{id:"commit-阶段"}},[n("a",{staticClass:"header-anchor",attrs:{href:"#commit-阶段"}},[t._v("#")]),t._v(" commit 阶段")]),t._v(" "),n("p",[t._v("上一节我们讲完了render阶段，本章节我们将要进入commit阶段的学习。")]),t._v(" "),n("p",[t._v("commit阶段的入口函数是"),n("code",[t._v("commitRoot()")]),t._v("，此函数在"),n("code",[t._v("performSyncWorkOnRoot()")]),t._v("和"),n("code",[t._v("finishConcurrentRender()")]),t._v("函数中调用。在commit阶段是同步执行的，不可以被打断，也就是说所有的更新需要一次性完成。")]),t._v(" "),n("p",[t._v("我们以"),n("code",[t._v("performSyncWorkOnRoot()")]),t._v("为例，看看"),n("code",[t._v("commitRoot()")]),t._v("的调用：")]),t._v(" "),n("div",{staticClass:"language-tsx extra-class"},[n("pre",{pre:!0,attrs:{class:"language-tsx"}},[n("code",[n("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("function")]),t._v(" "),n("span",{pre:!0,attrs:{class:"token function"}},[t._v("performSyncWorkOnRoot")]),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),n("span",{pre:!0,attrs:{class:"token parameter"}},[t._v("root")]),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),t._v(" "),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("{")]),t._v("\n\n    "),n("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// ...省略大部分代码")]),t._v("\n  \t"),n("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// render阶段的入口函数")]),t._v("\n    exitStatus "),n("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),t._v(" "),n("span",{pre:!0,attrs:{class:"token function"}},[t._v("renderRootSync")]),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),t._v("root"),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(",")]),t._v(" lanes"),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(";")]),t._v("\n\t\t"),n("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// ...省略代码")]),t._v("\n  \t"),n("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// commitRoot函数调用")]),t._v("\n    "),n("span",{pre:!0,attrs:{class:"token keyword"}},[t._v("const")]),t._v(" finishedWork"),n("span",{pre:!0,attrs:{class:"token operator"}},[t._v(":")]),t._v(" Fiber "),n("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),t._v(" "),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),t._v("root"),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),t._v("current"),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),t._v("alternate"),n("span",{pre:!0,attrs:{class:"token operator"}},[t._v(":")]),t._v(" "),n("span",{pre:!0,attrs:{class:"token builtin"}},[t._v("any")]),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(";")]),t._v("\n    root"),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),t._v("finishedWork "),n("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),t._v(" finishedWork"),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(";")]),t._v("\n    root"),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(".")]),t._v("finishedLanes "),n("span",{pre:!0,attrs:{class:"token operator"}},[t._v("=")]),t._v(" lanes"),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(";")]),t._v("\n    "),n("span",{pre:!0,attrs:{class:"token function"}},[t._v("commitRoot")]),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("(")]),t._v("root"),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(")")]),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(";")]),t._v("\n  \t"),n("span",{pre:!0,attrs:{class:"token comment"}},[t._v("// ...省略代码")]),t._v("\n"),n("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("}")]),t._v("\n")])])]),n("p",[t._v("有上述代码可知，在调用render阶段完成后，获取"),n("code",[t._v("workInProgress")]),t._v("的"),n("code",[t._v("rootFiber")]),t._v("节点，在")])])}),[],!1,null,null,null);s.default=o.exports}}]);