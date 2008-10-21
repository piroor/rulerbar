/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is "Ruler Bar".
 *
 * The Initial Developer of the Original Code is ClearCode Inc.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): SHIMODA Hiroshi <piro@p.club.ne.jp>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
 
var RulerBar = { 
	
	kBAR    : 'ruler-bar', 
	kCURSOR : 'current',

	kSCALEBAR   : 'ruler-scalebar',
	kRULER_CELL : 'ruler-cell',

	kCURSORBAR            : 'ruler-cursorbar',
	kCURSORBAR_POSITIONER : 'ruler-cursorbar-positioner',

	kLINE_TOP : 1,
	kLINE_END : 2,
	kLINE_MIDDLE : 4,
	lastPosition : 1, // kLINE_END
 
/* properties */ 
	
	tabWidth : 8, 
	maxCount : 300,
	nonAsciiWidth : 2,
	shouldRoop : true,
	columnLevel3 : 20,
	columnLevel1 : 2,
	scale : 100,
 
	get wrapLength() 
	{
		var editor = this.editor;
		return (editor && !editor.wrapWidth && !this.bodyWidth) ? 0 :
			this._wrapLength ;
	},
	_wrapLength : 0,
	
	get bodyWidth() 
	{
		var value = this.contentBody.style.width;
		if (!value) return 0;
		var match = value.match(/^(\d+)ch$/i);
		if (match) return parseInt(match[1]);
		return 0;
	},
  
	get fontFamily() 
	{
		var w = this.frame.contentWindow;
		return w.getComputedStyle(this.contentBody, '').fontFamily;
	},
 
	get fontSize() 
	{
		var w = this.frame.contentWindow;
		var d = this.frame.contentDocument;
		var size = w.getComputedStyle(d.documentElement, '').fontSize;
		size = parseInt(size.match(/^\d+/));
		var scale = Math.max(1, this.scale);
		return size * (scale / 100);
	},
 
	get offset() 
	{
		var w = this.frame.contentWindow;
		var d = this.frame.contentDocument;
		var targets = [];

		var root = w.getComputedStyle(d.documentElement, '');
		targets.push(root.borderLeftWidth);
		targets.push(root.marginLeft);
		targets.push(root.paddingLeft);

		var body = w.getComputedStyle(this.contentBody, '');
		targets.push(body.borderLeftWidth);
		targets.push(body.marginLeft);
		targets.push(body.paddingLeft);

		var offset = 0;
		targets.forEach(function(aTarget) {
			offset += parseInt(String(aTarget).match(/^\d+/))
		});

		return offset;
	},
 
	get color() 
	{
		return this.frame.contentWindow.getComputedStyle(this.contentBody, '').color;
	},
 
	get backgroundColor() 
	{
		var color = this.frame.contentWindow.getComputedStyle(this.contentBody, '').backgroundColor;
		if (color == 'transparent')
			color = this.getPref('browser.display.use_system_colors') ?
				'-moz-Field' :
				this.getPref('browser.display.background_color');
		return color;
	},
  
/* elements */ 
	
	get bar() 
	{
		return document.getElementById(this.kBAR);
	},
 
	get scaleBar() 
	{
		return document.getElementById(this.kSCALEBAR);
	},
	
	get cursor() 
	{
		var nodes = document.getElementsByAttribute(this.kCURSOR, 'true');
		return nodes && nodes.length ? nodes[0] : null ;
	},
 
	get marks() 
	{
		return Array.slice(document.getElementsByAttribute(this.kRULER_CELL, 'true'));
	},
  
	get cursorPositioner() 
	{
		return document.getElementById(this.kCURSORBAR_POSITIONER);
	},
 
	get frame() 
	{
		return document.getElementById('content-frame');
	},
	
	get editor() 
	{
		return GetCurrentEditor();
	},
 
	get contentBody() 
	{
		return this.frame.contentDocument.body;
	},
  
	get calculator() 
	{
		return document.getElementById('rulerbar-calculator-frame');
	},
  
	handleEvent : function(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'DOMContentLoaded':
				this.init();
				break;

			case 'unload':
				this.destroy();
				break;

			case 'keypress':
				this.lastKeyCode = aEvent.keyCode;
				break;

			case 'click':
			case 'dragover':
				this.lastClickedScreenX = aEvent.screenX;
				this.lastClickedScreenY = aEvent.screenY;
				break;

			case 'DOMAttrModified':
				if (
					aEvent.target == this.contentBody &&
					(aEvent.attrName == 'text' || aEvent.attrName == 'bgcolor')
					) {
					this.updateRulerAppearanceWithDelay();
				}
				break;

			case 'compose-window-close':
				this.contentBody.removeEventListener('DOMAttrModified', this, true);
//				this.contentBody.removeEventListener('DOMNodeInserted', this, true);
				break;
		}
	},
	
	lastKeyCode : -1, 
	lastClickedScreenX : -1,
	lastClickedScreenY : -1,
  
/* selection */ 
	
	notifySelectionChanged : function(aDocument, aSelection, aReason) 
	{
		window.setTimeout(function(aSelf) {
			aSelf.updateCursor(aReason);
		}, 0, this, aReason);
	},
 
	addSelectionListener : function() 
	{
		if (!this.editor) {
			window.setTimeout(function(aSelf) {
				aSelf.addSelectionListener();
			}, 10, this);
			return;
		}
		if (this._listening) return;
		this.editor
			.selection
			.QueryInterface(Components.interfaces.nsISelectionPrivate)
			.addSelectionListener(this);
		this._listening = true;
	},
	_listening : false,
 
	removeSelectionListener : function() 
	{
		if (!this._listening) return;
		this.editor
			.selection
			.QueryInterface(Components.interfaces.nsISelectionPrivate)
			.removeSelectionListener(this);
		this._listening = false;
	},
  
/* initialize */ 
	
	init : function() 
	{
		window.removeEventListener('DOMContentLoaded', this, false);

		this.overrideStartupMethod();

		window.addEventListener('unload', this, false);
		document.documentElement.addEventListener('compose-window-close', this, false);
		this.frame.addEventListener('keypress', this, false);
		this.frame.addEventListener('click', this, false);
		this.frame.addEventListener('dragover', this, false);

		this.addPrefListener();
		this.observe(null, 'nsPref:changed', 'mailnews.wraplength');
		this.observe(null, 'nsPref:changed', 'extensions.rulerbar.tabWidth');
		this.observe(null, 'nsPref:changed', 'extensions.rulerbar.nonAsciiWidth');
		this.observe(null, 'nsPref:changed', 'extensions.rulerbar.shouldRoop');
		this.observe(null, 'nsPref:changed', 'extensions.rulerbar.maxCount');
		this.observe(null, 'nsPref:changed', 'extensions.rulerbar.column.level3');
		this.observe(null, 'nsPref:changed', 'extensions.rulerbar.column.level1');
		this.observe(null, 'nsPref:changed', 'extensions.rulerbar.scale');
	},
	
	overrideStartupMethod : function() 
	{
		eval('window.ComposeStartup = '+window.ComposeStartup.toSource().replace(
			'{',
			'{ RulerBar.delayedInit();'
		));
	},
 
	delayedInit : function() 
	{
		this.initRuler();
		window.setTimeout(function(aSelf) {
			aSelf.addSelectionListener();
			aSelf.contentBody.addEventListener('DOMAttrModified', aSelf, true);
//			aSelf.contentBody.addEventListener('DOMNodeInserted', aSelf, true);
		}, 0, this);
	},
  
	destroy : function() 
	{
		window.removeEventListener('unload', this, false);
		document.documentElement.removeEventListener('compose-window-close', this, false);
		this.frame.removeEventListener('keypress', this, false);
		this.frame.removeEventListener('click', this, false);
		this.frame.removeEventListener('dragover', this, false);
		this.removePrefListener();
		this.removeSelectionListener();
	},
  
	initRuler : function() 
	{
		var range = document.createRange();
		range.selectNodeContents(this.scaleBar);
		range.deleteContents();
		range.detach();
		this.updateRulerAppearance();
		if (this._createTimer) return;
		this._createTimer = window.setTimeout(function(aSelf) {
			aSelf.calculator.style.visibility = 'hidden';
			aSelf.buildRulerMarks();
			aSelf.updateOffset();
			aSelf.updateCursor();
			aSelf._createTimer = null;
		}, 0, this);
	},
	
	updateRulerAppearance : function() 
	{
		this.bar.setAttribute(
			'style',
			'font-size:'+this.fontSize+'px;'+
			'color:'+this.color+';'+
			'background-color:'+this.backgroundColor+';'
		);
	},
	
	updateRulerAppearanceWithDelay : function() 
	{
		if (this._updateRulerAppearanceWithDelayTimer) {
			window.clearTimeout(this._updateRulerAppearanceWithDelayTimer);
			this._updateRulerAppearanceWithDelayTimer = null;
		}
		this._updateRulerAppearanceWithDelayTimer = window.setTimeout(function(aSelf) {
			aSelf.updateRulerAppearance();
			aSelf._updateRulerAppearanceWithDelayTimer = null;
		}, 0, this);
	},
	_updateRulerAppearanceWithDelayTimer : null,
  
	buildRulerMarks : function() 
	{
		var rulerBox = this.scaleBar;

		var fontSize = this.fontSize;
		var size = parseInt(fontSize / 2);
		var numCellWidth = 5;
		var wrapLength = this.wrapLength;
		var maxCount = Math.max(wrapLength * 3, this.maxCount);
		var counterCol = this.columnLevel3;
		if (counterCol <= 0) counterCol = 20;
		var minCol = this.columnLevel1;
		if (minCol <= 0) minCol = 2;

		var unit, level;
		for (var i = 0; i < maxCount; i++)
		{
			level = i % counterCol == 0 ? 3 :
					i % 10 == 0 ? 2 :
					i % minCol == 0 ? 1 :
					0 ;
			unit = document.createElement('vbox');
			unit.setAttribute(
				'class',
				this.kRULER_CELL+
				' level'+level+
				((wrapLength && i == wrapLength) ? ' wrapLength' : '')
			);
			unit.setAttribute(this.kRULER_CELL, true);
			unit.setAttribute('style', 'width:'+size+'px');
			unit.setAttribute('tooltiptext', i);
			rulerBox.appendChild(unit);

			if (level == 3) {
				unit.appendChild(document.createElement('label'))
					.setAttribute('value', i);
				unit.setAttribute(
					'style',
					'width:'+(size*numCellWidth)+'px;'+
					'margin-right:-'+(size*(numCellWidth-1))+'px;'
				);
			}
		}
	},
 
	updateOffset : function() 
	{
		var offset = this.offset;
		Array.slice(this.bar.childNodes).forEach(function(aNode) {
			aNode.style.marginLeft = offset+'px';
		}, this);
	},
  
	updateCursor : function(aReason) 
	{
		if (this._updating || !this.editor) return;

		this._updating = true;
		this.lastReason = aReason || 0 ;

		var lastPos = 0;
		var cursor = this.cursor;
		var marks = this.marks;
		if (cursor) {
			lastPos = marks.indexOf(cursor);
			cursor.removeAttribute(this.kCURSOR);
		}

		var line = this.getCurrentLine(this.editor.selection);
		if ('physicalPosition' in line) {
			this.cursorPositioner.setAttribute('style', 'width:'+line.physicalPosition+'px');
		}
		else {
			var pos = (this.lastPosition == this.kLINE_TOP) ? 0 : line.leftCount ;
			if (pos in marks)
				marks[pos].setAttribute(this.kCURSOR, true);
		}

		this._updating = false;
	},
	_updating : false,
	lastReason : -1,
	
	getCurrentLine : function(aSelection) 
	{
		var physical = this.getPref('extensions.rulerbar.physicalPositioning');

		if (!aSelection.rangeCount) {
			var line = {
				left       : '',
				leftCount  : 0,
				right      : '',
				rightCount : 0
			};
			if (physical) line.physicalPosition = 0;
			return line;
		}

		var node = aSelection.focusNode;
		var leftRange = node.ownerDocument.createRange();
		var rightRange = node.ownerDocument.createRange();
		var offset = aSelection.focusOffset;
		if (node.nodeType != Node.TEXT_NODE) {
			node = this.getPreviousNodeFromSelection(aSelection) || node;
			offset = (node.nodeType == Node.TEXT_NODE) ? node.nodeValue.length : 0 ;
		}
		var focusNode = node;

		leftRange.selectNode(node);
		rightRange.selectNode(node);
		if (node.nodeType == Node.TEXT_NODE) {
			leftRange.setEnd(node, offset);
			rightRange.setStart(node, (node.nodeValue || '').length - offset);
		}
		else {
			rightRange.collapse(false);
		}

		var walker = node.ownerDocument.createTreeWalker(
				node.ownerDocument,
				NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
				this,
				false
			);

		walker.currentNode = focusNode;
		while (
			(node = walker.previousNode()) &&
			!this.isBody(node) &&
			!this.isBR(node)
			)
		{
			leftRange.setStartBefore(node);
		}

		walker.currentNode = focusNode;
		while (
			(node = walker.nextNode()) &&
			!this.isBody(node) &&
			!this.isBR(node)
			)
		{
			rightRange.setEndAfter(node);
		}

		var left  = leftRange.toString();
		var right = rightRange.toString();
		var line  = {
				focusNode  : focusNode,
				left       : left,
				leftCount  : this.getLogicalLength(left),
				right      : right,
				rightCount : this.getLogicalLength(right)
			};

		if (physical) {
			this.updateCalculator();

			var doc = this.calculator.contentDocument;
			var marker = doc.createElement('span');

			var fragment = doc.createDocumentFragment();
			if (!leftRange.collapsed)
				fragment.appendChild(doc.importNode(leftRange.cloneContents(), true));
			fragment.appendChild(marker);
			if (!rightRange.collapsed)
				fragment.appendChild(doc.importNode(rightRange.cloneContents(), true));

			var cRange = doc.createRange();
			cRange.selectNodeContents(doc.body);
			cRange.deleteContents();
			cRange.insertNode(fragment);
			cRange.detach();

			line.physicalPosition = doc.getBoxObjectFor(marker).screenX - doc.getBoxObjectFor(doc.body).screenX;
		}

		return this.processWrap(line);
	},
	
	updateCalculator : function() 
	{
		if (!this.calculator.contentDocument ||
			!this.calculator.contentDocument.body) return;

		var w = this.frame.contentWindow;
		var d = this.frame.contentDocument;
		var b = this.contentBody;

		var calculatorStyle = this.calculator.contentDocument.body.style;
		calculatorStyle.margin = w.getComputedStyle(b, '').margin;
		calculatorStyle.padding = w.getComputedStyle(b, '').padding;
		calculatorStyle.fontSize = this.fontSize+'px';
		calculatorStyle.fontFamily = this.fontFamily;
		var wrapLength = this.wrapLength;
		calculatorStyle.width = wrapLength ?
				wrapLength+'ch' :
				d.getBoxObjectFor(b).width+'px' ;
		calculatorStyle.whiteSpace = (wrapLength || this.frame.editortype == 'textmail')  ?
				'-moz-pre-wrap' :
				'normal' ;
	},
 
	getPreviousNodeFromSelection : function(aSelection) 
	{
		var doc = aSelection.focusNode.ownerDocument;
		var walker = doc.createTreeWalker(
				doc,
				NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
				this,
				false
			);
		walker.currentNode = aSelection.focusNode;

		var selectionRange = aSelection.getRangeAt(0);

		var node;
		var nodeRange = doc.createRange();
		while (node = walker.nextNode())
		{
			nodeRange.selectNode(node);
			if (nodeRange.compareBoundaryPoints(Range.START_TO_END, selectionRange) == 0)
				return node;
		}
		return null;
	},
 
	getLogicalLength : function(aString) 
	{
		var count = 0;
		aString.split('').forEach(function(aChar) {
			count += this.getLogicalLengthOfCharacter(aChar);
		}, this);
		return count;
	},
	
	getLogicalLengthOfCharacter : function(aChar) 
	{
		var code = aChar.charCodeAt(0);
		if (code == 9) { // Tab
			return this.tabWidth;
		}
		else if (code >=  0 && code <= 127) { // ASCII
			return 1;
		}
		else {
			return this.nonAsciiWidth;
		}
	},
  
	processWrap : function(aLine) 
	{
		if ('physicalPosition' in aLine) return aLine;

		var wrapLength = this.wrapLength;
		if (!this.shouldRoop || wrapLength <= 0) {
			this.lastPosition = this.calculateNewPosition(aLine);
			return aLine;
		}

		var leftCount = aLine.leftCount;
		if (leftCount > wrapLength) {
			leftCount = (leftCount % wrapLength) || wrapLength;
			var oldLeft = aLine.left.split('').reverse();
			var newLeft = '';
			for (let count = 0, char, i = 0; count < leftCount; i++)
			{
				char = oldLeft[i];
				newLeft = char + newLeft;
				count += this.getLogicalLengthOfCharacter(char);
			}
			aLine.left = newLeft;
			aLine.leftCount = leftCount;
			if (aLine.leftCount % 2 != this.getLogicalLength(aLine.left) % 2) { // ‘SŠp•¶Žš‚ÅÜ‚è•Ô‚³‚ê‚½ê‡
				if (aLine.leftCount == wrapLength) {
					aLine.leftCount = wrapLength-1;
				}
				else {
					aLine.leftCount++;
				}
			}
		}

		if (aLine.leftCount + aLine.rightCount > wrapLength) {
			var rightCount = wrapLength - aLine.leftCount;
			var oldRight = aLine.right.split('');
			var newRight = '';
			for (let count = 0, char, i = 0; count < rightCount; i++)
			{
				char = oldRight[i];
				newRight = char + newRight;
				count += this.getLogicalLengthOfCharacter(char);
			}
			aLine.right = newRight;
			aLine.rightCount = rightCount;
		}

		this.lastPosition = this.calculateNewPosition(aLine);

		return aLine;
	},
	
	calculateNewPosition : function(aLine) 
	{
		if (!this.shouldRoop || aLine.leftCount != this.wrapLength) {
			return this.isBR(aLine.focusNode) ? this.kLINE_TOP :
				!aLine.leftCount ? this.kLINE_TOP :
				!aLine.rightCount ? this.kLINE_END :
				this.kLINE_MIDDLE ;
		}

		// Maybe last of the line or top of the next line
		var onTop = false;
		const nsISelectionListener = Components.interfaces.nsISelectionListener;
		var reason = this.lastReason;
		if (
			!aLine.rightCount &&
			reason &&
			(
				reason & nsISelectionListener.MOUSEDOWN_REASON ||
				reason & nsISelectionListener.MOUSEUP_REASON
			)
			) {
			var bodyBox = this.frame.contentDocument.getBoxObjectFor(this.contentBody);
			onTop = this.lastClickedScreenX < bodyBox.screenX + (bodyBox.width / 3);
		}
		else if (
			reason &&
			reason & nsISelectionListener.KEYPRESS_REASON &&
			!(reason & nsISelectionListener.SELECTALL_REASON)
			) {
			const nsIDOMKeyEvent = Components.interfaces.nsIDOMKeyEvent;
			switch (this.lastKeyCode)
			{
				case nsIDOMKeyEvent.DOM_VK_LEFT:
					onTop = this.lastPosition == this.kLINE_MIDDLE;
					break;

				case nsIDOMKeyEvent.DOM_VK_RIGHT:
					onTop = this.lastPosition == this.kLINE_END;
					break;

				case nsIDOMKeyEvent.DOM_VK_UP:
				case nsIDOMKeyEvent.DOM_VK_DOWN:
				case nsIDOMKeyEvent.DOM_VK_PAGE_UP:
				case nsIDOMKeyEvent.DOM_VK_PAGE_DOWN:
					onTop = this.lastPosition == this.kLINE_TOP;
					break;

				case nsIDOMKeyEvent.DOM_VK_HOME:
					onTop = true;
					break;

				case nsIDOMKeyEvent.DOM_VK_BACK_SPACE:
					onTop = this.lastPosition == this.kLINE_MIDDLE;
					break;

				default:
					break;
			}
		}
		return onTop ? this.kLINE_TOP : this.kLINE_END ;
	},
   
	acceptNode : function(aNode) 
	{
		return this.isBR(aNode) || this.isBody(aNode) ?
			NodeFilter.FILTER_ACCEPT :
			NodeFilter.FILTER_SKIP ;
	},
 
	isBR : function(aNode) 
	{
		return (aNode.nodeType == Node.ELEMENT_NODE &&
			aNode.localName.toLowerCase() == 'br');
	},
 
	isBody : function(aNode) 
	{
		return (aNode.nodeType == Node.ELEMENT_NODE &&
			aNode.localName.toLowerCase() == 'body');
	},
  
/* Prefs */ 
	
	get Prefs() 
	{
		if (!this._Prefs) {
			this._Prefs = Components.classes['@mozilla.org/preferences;1'].getService(Components.interfaces.nsIPrefBranch);
		}
		return this._Prefs;
	},
	_Prefs : null,
 
	getPref : function(aPrefstring) 
	{
		try {
			switch (this.Prefs.getPrefType(aPrefstring))
			{
				case this.Prefs.PREF_STRING:
					return decodeURIComponent(escape(this.Prefs.getCharPref(aPrefstring)));
					break;
				case this.Prefs.PREF_INT:
					return this.Prefs.getIntPref(aPrefstring);
					break;
				default:
					return this.Prefs.getBoolPref(aPrefstring);
					break;
			}
		}
		catch(e) {
		}

		return null;
	},
 
	setPref : function(aPrefstring, aNewValue, aPrefObj) 
	{
		var pref = aPrefObj || this.Prefs ;
		var type;
		try {
			type = typeof aNewValue;
		}
		catch(e) {
			type = null;
		}

		switch (type)
		{
			case 'string':
				pref.setCharPref(aPrefstring, unescape(encodeURIComponent(aNewValue)));
				break;
			case 'number':
				pref.setIntPref(aPrefstring, parseInt(aNewValue));
				break;
			default:
				pref.setBoolPref(aPrefstring, aNewValue);
				break;
		}
		return true;
	},
 
	clearPref : function(aPrefstring) 
	{
		try {
			this.Prefs.clearUserPref(aPrefstring);
		}
		catch(e) {
		}

		return;
	},
 
	addPrefListener : function() 
	{
		var observer = this;
		var domains = ('domains' in observer) ? observer.domains : [observer.domain] ;
		try {
			var pbi = this.Prefs.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
			for (var i = 0; i < domains.length; i++)
				pbi.addObserver(domains[i], observer, false);
		}
		catch(e) {
		}
	},
 
	removePrefListener : function() 
	{
		var observer = this;
		var domains = ('domains' in observer) ? observer.domains : [observer.domain] ;
		try {
			var pbi = this.Prefs.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
			for (var i = 0; i < domains.length; i++)
				pbi.removeObserver(domains[i], observer, false);
		}
		catch(e) {
		}
	},
 
	observe : function(aSubject, aTopic, aPrefName) 
	{
		if (aTopic != 'nsPref:changed') return;

		var value = this.getPref(aPrefName);
		switch (aPrefName)
		{
			default:
				if (aPrefName.indexOf('font.size.') == 0) {
					this.initRuler();
				}
				else if (aPrefName.indexOf('browser.display.') == 0) {
					this.updateRulerAppearanceWithDelay();
				}
				return;

			case 'mailnews.wraplength':
				this._wrapLength = value;
				break;

			case 'extensions.rulerbar.tabWidth':
				this.tabWidth = value;
				return;

			case 'extensions.rulerbar.nonAsciiWidth':
				this.nonAsciiWidth = value;
				return;

			case 'extensions.rulerbar.shouldRoop':
				this.shouldRoop = value;
				return;

			case 'extensions.rulerbar.maxCount':
				this.maxCount = value;
				break;

			case 'extensions.rulerbar.column.level3':
				this.columnLevel3 = value;
				break;

			case 'extensions.rulerbar.column.level1':
				this.columnLevel1 = value;
				break;

			case 'extensions.rulerbar.scale':
				this.scale = value;
				break;
		}
		this.initRuler();
	},
	domains : [
		'extensions.rulerbar.',
		'mailnews.wraplength',
		'font.size.',
		'browser.display.foreground_color',
		'browser.display.background_color',
		'browser.display.use_system_colors'
	]
  
}; 

window.addEventListener('DOMContentLoaded', RulerBar, false);
  
