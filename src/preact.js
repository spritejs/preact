import { h, h as createElement } from './h';
import { cloneElement } from './clone-element';
import { Component } from './component';
import { render } from './render';
import { rerender } from './render-queue';
import options from './options';
import { use } from './dom';

function createRef() {
	return {};
}

if (typeof spritejs !== 'undefined') {
	/* global spritejs */
	use(spritejs);
}

export default {
	h,
	createElement,
	cloneElement,
	createRef,
	Component,
	render,
	rerender,
	options
};

export {
	h,
	createElement,
	cloneElement,
	createRef,
	Component,
	render,
	rerender,
	options
};
