# 概念篇
在React中有大量的概念，我们平常打交道最多的是**JSX**，虚拟DOM，Fiber，React Compenent，React Element等，但是我们可能从来没有深入了解过他们之间的关系？
- **JSX**和Fiber是同一个东西吗？
- **JSX**和虚拟DOM是同一个东西吗？
- React Compenent，React Element他们之间的关系是什么？
那我们本章就从这些基本概念开始学习。
## JSX
作为React开发者我们会大量使用**JSX**，如果你对**JSX**还不了解，请阅读[官网描述](https://react.docschina.org/docs/introducing-jsx.html)。
**JSX**通过Babel编译时会被编译成React.createElement
```javascript
function App() {
    // JSX
    return (
        <div>
        <p>Hellp world</p>
        </div>
    );
}

function App() {
    // react.createElement
    return React.createElement("div", null, React.createElement("p", null, "You clicked ", count, " times"));
}
```
> 因为编译后，后调用React.createElement，这就是为什么在React17前每个文件都要现实的导入React的原因, 否则就会在运行的时候报 **未定义变量 React**错误。在React17后不需要显示引入React了。

由此可见**JSX**最终会被编译成react.createElement，那么react.createElement做什么了？
## react.createElement
```javascript
export function createElement(type, config, children) {
  let propName;
  
  const props = {};

  let key = null;
  let ref = null;
  // 可以忽略
  let self = null;
  let source = null;

  if (config != null) {
    if (hasValidRef(config)) {
      ref = config.ref;

      if (__DEV__) {
        warnIfStringRefCannotBeAutoConverted(config);
      }
    }
    if (hasValidKey(config)) {
      key = '' + config.key;
    }

    self = config.__self === undefined ? null : config.__self;
    source = config.__source === undefined ? null : config.__source;
    for (propName in config) {
      if (
        hasOwnProperty.call(config, propName) &&
        !RESERVED_PROPS.hasOwnProperty(propName)
      ) {
        props[propName] = config[propName];
      }
    }
  }
  const childrenLength = arguments.length - 2;
  if (childrenLength === 1) {
    props.children = children;
  } else if (childrenLength > 1) {
    const childArray = Array(childrenLength);
    for (let i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 2];
    }
    props.children = childArray;
  }

  if (type && type.defaultProps) {
    const defaultProps = type.defaultProps;
    for (propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName];
      }
    }
  }
  return ReactElement(
    type,
    key,
    ref,
    self,
    source,
    ReactCurrentOwner.current,
    props,
  );
}
```

- type：有三种类型：string，function，class。
  - string表示当前类型的DOM，如：'div'
  - function：表示function component
  - class：表示class compnent
- config：JSX中绑定的属性
- children：JSX中的children

从源码我们我们可以看到react.createElement函数的中的逻辑还是比较简单的，主要做了这几件事：

- 将config中的key和ref提取出来单独处理
- 将config中除了key，ref，self，source外的属性赋值给props
- 如果type（一般是class component）上有defaultProps属性，处理defaultProps属性
- 调用ReactElement

从上述代码中，我们可以看到react.createElement最终会调用ReactElement。

### ReactElement

```javascript
const ReactElement = function(type, key, ref, self, source, owner, props) {
  const element = {
    $$typeof: REACT_ELEMENT_TYPE,
    type: type,
    key: key,
    ref: ref,
    props: props,
    _owner: owner,
  };
  return element;
};
```

在ReactElement中返回了一个对象，对象的$$typeof被赋值为REACT_ELEMENT_TYPE，那么这个对象就是React Element嘛？我们都知道在React中有个判断是否为Reacrt Element的函数isValidElement：

```javascript
export function isValidElement(object) {
  return (
    typeof object === 'object' &&
    object !== null &&
    object.$$typeof === REACT_ELEMENT_TYPE
  );
}
```

从代码中可以看出，`object.$$typeof === REACT_ELEMENT_TYPE`就是合法React Element。综上所述React Element就是JSX运行时的结果，也就是每个JSX最终都会被转成React Element。

那么React Compenent呢？

## React Compenent

众所周知在React中有两种Compenent，一种是`ClassCompenent`，一种`FunctionCompenet`。其中`ClassCompenent`都会继承`React.Component`/`React.PureComponent`，那么我们先来看看两种对象：

```javascript
// Component
function Component(props, context, updater) {
  this.props = props;
  this.context = context;
  this.refs = emptyObject;
  this.updater = updater || ReactNoopUpdateQueue;
}

Component.prototype.isReactComponent = {};
Component.prototype.setState = function(partialState, callback) {
  invariant(
    typeof partialState === 'object' ||
      typeof partialState === 'function' ||
      partialState == null,
    'setState(...): takes an object of state variables to update or a ' +
      'function which returns an object of state variables.',
  );
  this.updater.enqueueSetState(this, partialState, callback, 'setState');
};
Component.prototype.forceUpdate = function(callback) {
  this.updater.enqueueForceUpdate(this, callback, 'forceUpdate');
};
// PureComponent
function PureComponent(props, context, updater) {
  this.props = props;
  this.context = context;
  this.refs = emptyObject;
  this.updater = updater || ReactNoopUpdateQueue;
}

const pureComponentPrototype = (PureComponent.prototype = new ComponentDummy());
pureComponentPrototype.constructor = PureComponent;
Object.assign(pureComponentPrototype, Component.prototype);
// 此处重要，在更新的阶段，会isPureReactComponent是否为真，如果为真，会对props和state进行比较，来判断是否进行更新
pureComponentPrototype.isPureReactComponent = true;

export {Component, PureComponent};
```

从上面的代码可以看出，Component对象只包含了props，context，refs，updater（会根据不同的环境注入不同的updater）isReactComponent（用来判断是否为ClassCompenent）五个属性，以及setState和forceUpdate两个用来触发更新的函数。而PureComponent对象，继承了Component，只是比Component对象多了个isPureReactComponent属性，此属性如果为真表示在Compenent更新前要进行props和state比较，用来确定组件是否更新。

```javascript
if (ctor.prototype && ctor.prototype.isPureReactComponent) {
    return (!shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState));
  }
```

从react.createElement中我们知道，无论ClassCompenent还是FunctionCompenent最终都会挂载到ReactElement对象的type中，形成如下对象：

```javascript
{
  $$typeof: Symbol(react.element),
  key: null,
  props: {},
  ref: null,
  type: ƒ App(),
  _owner: null,
  _store: {validated: false},
  _self: null,
  _source: null 
}
```

那么React Element和Fiber有什么关系，从上述代码中，我们发现React Element并没有**schedule**，**schedule**，**render**所需的信息，由此可以猜测，这些信息就应该保存在Fiber中了。

## Fiber

```typescript
export type Fiber = {
  // 当前Fiber的类型，比如FunctionComponent
  tag: WorkTag
	// key
  key: null | string,
  // 当前Fiber对应的节点的类型，classComponent FunctionCompoent element.tagName，一般和下面的type相同
  elementType: any,
	// 和上面的elementType相同，但是在LazyComponent时，type=null
  type: any,
  // satteNode 有四种情况
  // 1. functionCoponent stateNode = null
  // 2. classComponent stateNode = instance
  // 3. Dom类型， stateNode 为当前dom实例
  // 4. rootFiber stateNode = fiberRoot
  stateNode: any,
  // parent Fibers
  return: Fiber | null,
  // 当前fiber的第一个子节点
  child: Fiber | null,
  // 当前节点的兄弟节点
  sibling: Fiber | null,
  // 当前节点的位置
  index: number,
  // ref
  ref:
    | null
    | (((handle: mixed) => void) & {_stringRef: ?string, ...})
    | RefObject,
  // 从父节点中出入的props
  // 对象
  pendingProps: any,
  // 保存本次更新，下次更新对比用，在beiginWork完成后赋值                        
  memoizedProps: any,

  // 属性更新队列
  updateQueue: mixed,

  // 保存本次status
  memoizedState: any,

  dependencies: Dependencies | null,

  /**
  NoMode = 0b00000;
	StrictMode = 0b00001;
  BlockingMode = 0b00010;
	ConcurrentMode = 0b00100;
	ProfileMode = 0b01000;
	DebugTracingMode = 0b10000;
  **/
  mode: TypeOfMode,
  // Effect 标记
  flags: Flags,
  subtreeFlags: Flags,
  deletions: Array<Fiber> | null,
	// 下一个effect
  nextEffect: Fiber | null,
	// 本次更新的第一个effect
  firstEffect: Fiber | null,
  // 本次更新最后一个effec                            
  lastEffect: Fiber | null,
	// lane模型优先级
  lanes: Lanes,                       
  childLanes: Lanes,
  // 双缓存中，指向另一棵树的节点
  alternate: Fiber | null,
	// 渲染当前节点，及其后代节点所用的时间，只有在enableProfilerTimer开启时才会计算
  actualDuration?: number,
  // 表示启动渲染的时间
  actualStartTime?: number,

  // 本次渲染所用时间
  selfBaseDuration?: number,
	// 时间总和，在commite阶段计算
  treeBaseDuration?: number,

  // Conceptual aliases
  // workInProgress : Fiber ->  alternate The alternate used for reuse happens
  // to be the same as work in progress.
  // __DEV__ only
  _debugID?: number,
  _debugSource?: Source | null,
  _debugOwner?: Fiber | null,
  _debugIsCurrentlyTiming?: boolean,
  _debugNeedsRemount?: boolean,

  // Used to verify that the order of hooks does not change between renders.
  _debugHookTypes?: Array<HookType> | null,
|};
```

React在mount阶段，会根据JSX对象，计算出Fiber对象，并将JSX对象保存在pendingProps中，在beignWork后JSX对象也会保存在memoizedProps中，输出到子节点中。

在update时Reconciler会将JSX和Fiber上的属性惊醒对比，来确定当前节点是否需要更新。并将对比结果的标记打到flag上。

**现在我们已经知道了React中的主要数据结构，下一章我们将正式开始render阶段**

>本文部分观点参考：https://react.iamkasong.com/

