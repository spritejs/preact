import { IS_NON_DIMENSIONAL } from '../constants';
import { applyRef } from '../util';
import options from '../options';

let spritejs = null;
export function use(context) {
	spritejs = context;
}

/**
 * A DOM event listener
 * @typedef {(e: Event) => void} EventListner
 */

/**
 * A mapping of event types to event listeners
 * @typedef {Object.<string, EventListener>} EventListenerMap
 */

/**
 * Properties Preact adds to elements it creates
 * @typedef PreactElementExtensions
 * @property {string} [normalizedNodeName] A normalized node name to use in diffing
 * @property {EventListenerMap} [_listeners] A map of event listeners added by components to this DOM node
 * @property {import('../component').Component} [_component] The component that rendered this DOM node
 * @property {function} [_componentConstructor] The constructor of the component that rendered this DOM node
 */

/**
 * A DOM element that has been extended with Preact properties
 * @typedef {Element & ElementCSSInlineStyle & PreactElementExtensions} PreactElement
 */

const isBrowser = typeof window !== 'undefined' && window.document && window.document.documentElement;

/**
 * Create an element with the given nodeName.
 * @param {string} nodeName The DOM node to create
 * @param {Object} attrs The vnode attributes
 * @param {boolean} [isSvg=false] If `true`, creates an element within the SVG
 *  namespace.
 * @returns {PreactElement} The created DOM node
 */
export function createNode(nodeName, attrs, isSvg) {
	if (!spritejs) throw new Error('No spritejs context.');
	const isValidNodeType = spritejs.isValidNodeType;
	const createSpriteNode = spritejs.createNode;

	/** @type {PreactElement} */
	let node = null;
	const isSpriteNode = isValidNodeType(nodeName) && (nodeName !== 'label' || attrs.text != null);

	if (isSpriteNode && nodeName === 'scene') {
		if (isBrowser) {
			const elm = document.createElement('div');
			if (attrs.id) elm.id = attrs.id;
			attrs.resolution = attrs.resolution || 'flex';
			node = createSpriteNode('scene', elm, attrs);
		} else {
			node = createSpriteNode('scene', `#${attrs.id}` || '#default', attrs);
		}
		if (attrs.resources) {
			const resources = attrs.resources;
			node.preload(...resources).then(() => {
				node.dispatchEvent('load', { resources });
			});
		}
	} else if (isSpriteNode) {
		attrs = Object.assign({}, attrs);
		Object.keys(attrs).forEach((key) => {
			// ignore events
			if (key.indexOf('on') === 0) {
				delete attrs[key];
			}
		});
		node = createSpriteNode(nodeName, attrs);
	} else if (isBrowser) {
		node = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', nodeName) : document.createElement(nodeName);
		node.normalizedNodeName = nodeName;
	}
	return node;
}

/**
 * Remove a child node from its parent if attached.
 * @param {Node} node The node to remove
 */
export function removeNode(node) {
	let parentNode = node.parentNode;
	if (parentNode) parentNode.removeChild(node);
	else if (node.container && node.container.nodeType === 1) {
		// remove scene
		node.container.remove();
	}
}

export function appendNode(parent, node) {
	if (node.container && node.container.nodeType === 1) {
		const ret = parent.appendChild(node.container);
		node.parent = parent;
		if (node.updateResolution) {
			setTimeout(() => {
				node.updateResolution();
				node.updateViewport();
			});
		}
		return ret;
	}
	return parent.appendChild(node);
}

export function replaceNode(newNode, oldNode) {
	if (newNode.container && newNode.container.nodeType === 1) {
		newNode = newNode.container;
	}
	if (oldNode.container && oldNode.container.nodeType === 1) {
		oldNode = oldNode.container;
	}
	return oldNode.parentNode.replaceNode(newNode, oldNode);
}

export function insertBefore(parent, newNode, refNode) {
	if (newNode.container && newNode.container.nodeType === 1) {
		newNode = newNode.container;
	}
	if (refNode.container && refNode.container.nodeType === 1) {
		refNode = refNode.container;
	}
	return parent.insertBefore(newNode, refNode);
}

/**
 * Set a named attribute on the given Node, with special behavior for some names
 * and event handlers. If `value` is `null`, the attribute/handler will be
 * removed.
 * @param {PreactElement} node An element to mutate
 * @param {string} name The name/key to set, such as an event or attribute name
 * @param {*} old The last value that was set for this name/node pair
 * @param {*} value An attribute value, such as a function to be used as an
 *  event handler
 * @param {boolean} isSvg Are we currently diffing inside an svg?
 * @private
 */
export function setAccessor(node, name, old, value, isSvg) {
	if (name==='className') name = 'class';


	if (name==='key') {
		// ignore
	}
	else if (name==='ref') {
		applyRef(old, null);
		applyRef(value, node);
	}
	else if (name==='class' && !isSvg) {
		node.className = value || '';
	}
	else if (name==='style') {
		if (!value || typeof value==='string' || typeof old==='string') {
			node.style.cssText = value || '';
		}
		if (value && typeof value==='object') {
			if (typeof old!=='string') {
				for (let i in old) if (!(i in value)) node.style[i] = '';
			}
			for (let i in value) {
				node.style[i] = typeof value[i]==='number' && IS_NON_DIMENSIONAL.test(i)===false ? (value[i]+'px') : value[i];
			}
		}
	}
	else if (name==='dangerouslySetInnerHTML') {
		if (value) node.innerHTML = value.__html || '';
	}
	else if (name[0]=='o' && name[1]=='n') {
		let useCapture = name !== (name=name.replace(/Capture$/, ''));
		name = name.toLowerCase().substring(2);
		if (value) {
			if (!old) node.addEventListener(name, eventProxy, useCapture);
		}
		else {
			node.removeEventListener(name, eventProxy, useCapture);
		}
		(node._listeners || (node._listeners = {}))[name] = value;
	}
	else if (name!=='list' && name!=='type' && !isSvg && name in node) {
		// Attempt to set a DOM property to the given value.
		// IE & FF throw for certain property-value combinations.
		try {
			node[name] = value==null ? '' : value;
		} catch (e) { }
		if ((value==null || value===false) && name!='spellcheck') node.removeAttribute(name);
	}
	else {
		let ns = isSvg && (name !== (name = name.replace(/^xlink:?/, '')));
		// spellcheck is treated differently than all other boolean values and
		// should not be removed when the value is `false`. See:
		// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-spellcheck
		if (value==null || value===false) {
			if (ns) node.removeAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase());
			else node.removeAttribute(name);
		}
		else if (typeof value!=='function') {
			if (ns) node.setAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase(), value);
			else node.setAttribute(name, value);
		}
	}
}


/**
 * Proxy an event to hooked event handlers
 * @param {Event} e The event object from the browser
 * @private
 */
function eventProxy(e) {
	return this._listeners[e.type](options.event && options.event(e) || e);
}
