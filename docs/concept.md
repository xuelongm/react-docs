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
> 因为编译后，后调用React.createElement，这就是为什么在React17前每个文件都要现实的导入React的原因, 否则就会在运行的时候报 **未定义变量 React**错误。

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
- 如果type上defaultProps属性，处理defaultProps属性
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

从代码中可以看出，object.$$typeof === REACT_ELEMENT_TYPE就是合法React Element。综上所述React Element就是JSX运行时的结果，也就是每个JSX最终都会被转成React Element。

那么React Compenent呢？

## React Compenent

众所周知在React中有两种Compenent，一种是ClassCompenent，一种FunctionCompenet。其中ClassCompenent都会继承React.Component/React.PureComponent，那么我们先来看看两种对象：

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





