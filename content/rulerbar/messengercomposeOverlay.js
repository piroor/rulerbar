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
	
	kBAR             : 'ruler-bar', 
	kCURSOR          : 'ruler-cursor-box',
	kRULER_UNIT_BOX  : 'ruler-unit-box',
 
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
		return (editor && !editor.wrapWidth) ? 0 :
			this._wrapLength ;
	},
	_wrapLength : 0,
 
	get fontSize() 
	{
		var w = this.contentWindow;
		var d = w.document;
		var size = w.getComputedStyle(d.documentElement, '').fontSize;
		size = parseInt(size.match(/^\d+/));
		var scale = Math.max(1, this.scale);
		return size * (scale / 100);
	},
 
	get offset() 
	{
		var w = this.contentWindow;
		var d = w.document;
		var targets = [];

		var root = w.getComputedStyle(d.documentElement, '');
		targets.push(root.borderLeftWidth);
		targets.push(root.marginLeft);
		targets.push(root.paddingLeft);

		var body = w.getComputedStyle(this.body, '');
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
		return this.contentWindow.getComputedStyle(this.body, '').color;
	},
 
	get backgroundColor() 
	{
		var color = this.contentWindow.getComputedStyle(this.body, '').backgroundColor;
		if (color == 'transparent')
			color = this.getPref('browser.display.background_color');
		return color;
	},
  
/* elements */ 
	
	get bar() 
	{
		return document.getElementById(this.kBAR);
	},
	
	get cursor() 
	{
		var nodes = document.getElementsByAttribute(this.kCURSOR, 'true');
		return nodes && nodes.length ? nodes[0] : null ;
	},
 
	get marks() 
	{
		return Array.slice(document.getElementsByAttribute(this.kRULER_UNIT_BOX, 'true'));
	},
  
	get frame() 
	{
		return document.getElementById('content-frame');
	},
	
	get contentWindow() 
	{
		return this.frame.contentWindow;
	},
 
	get editor() 
	{
		return GetCurrentEditor();
	},
 
	get body() 
	{
		return this.contentWindow.document.getElementsByTagName('body')[0];
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
				this.addSelectionListener();
				break;

			case 'click':
				this.addSelectionListener();
				break;

			case 'DOMAttrModified':
				if (
					aEvent.target == this.body &&
					(aEvent.attrName == 'text' || aEvent.attrName == 'bgcolor')
					) {
					window.setTimeout(function(aSelf) {
						aSelf.updateRulerAppearance();
					}, 0, this);
				}
				break;

			case 'compose-window-close':
				this.body.removeEventListener('DOMAttrModified', this, true);
//				this.body.removeEventListener('DOMNodeInserted', this, true);
				break;
		}
	},
	
	lastKeyCode : -1, 
  
/* selection */ 
	
	notifySelectionChanged : function(aDocument, aSelection, aReason) 
	{
		this.updateCursor(aReason);
	},
 
	addSelectionListener : function() 
	{
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
			'{ RulerBar.delayedInit(); RulerBar.reset();'
		));
	},
 
	reset : function() 
	{
		if (this.bar) {
			this.bar.parentNode.removeChild(this.bar);
		}
		this.createRuler();
	},
 
	delayedInit : function() 
	{
		window.setTimeout(function(aSelf) {
			aSelf.body.addEventListener('DOMAttrModified', aSelf, true);
//			aSelf.body.addEventListener('DOMNodeInserted', aSelf, true);
		}, 0, this);
	},
  
	destroy : function() 
	{
		window.removeEventListener('unload', this, false);
		document.documentElement.removeEventListener('compose-window-close', this, false);
		this.frame.addEventListener('keypress', this, false);
		this.frame.addEventListener('click', this, false);
		this.removePrefListener();
		this.removeSelectionListener();
	},
  
	createRuler : function() 
	{
		var bar = document.createElement('stack');
		bar.setAttribute('id', this.kBAR);
		this.updateRulerAppearance(bar);

		var frame = this.frame;
		frame.parentNode.insertBefore(bar, frame);

		if (this._createTimer) return;
		this._createTimer = window.setTimeout(function(aSelf) {
			aSelf.buildRulerMarks();
			aSelf.updateOffset();
			aSelf.updateCursor();
			aSelf._createTimer = null;
		}, 0, this);
	},
	
	updateRulerAppearance : function(aBar) 
	{
		(aBar || this.bar).setAttribute(
			'style',
			'font-size:'+this.fontSize+'px;'+
			'color:'+this.color+';'+
			'background-color:'+this.backgroundColor+';'
		);
	},
 
	buildRulerMarks : function() 
	{
		var bar = this.bar;
		var rulerBox = document.createElement('hbox');

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
				this.kRULER_UNIT_BOX+
				' level'+level+
				((wrapLength && i == wrapLength) ? ' wrapLength' : '')
			);
			unit.setAttribute(this.kRULER_UNIT_BOX, true);
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

		bar.appendChild(rulerBox);
	},
 
	updateOffset : function() 
	{
		var offset = this.offset;
		Array.slice(this.bar.childNodes).forEach(function(aNode) {
			aNode.setAttribute('style', 'margin-left:'+offset+'px');
		}, this);
	},
 
	updateCursor : function(aReason) 
	{
		if (this._updating || !this.editor) return;

		this._updating = true;

		var lastPos = 0;
		var cursor = this.cursor;
		var marks = this.marks;
		if (cursor) {
			lastPos = marks.indexOf(cursor);
			cursor.removeAttribute(this.kCURSOR);
		}

		var line = this.getCurrentLine(this.editor.selection);
		var pos = line.leftCount;
		var rest = line.rightCount;

		var wrapLength = this.wrapLength;
		if (
			this.shouldRoop &&
			wrapLength > 0 &&
			pos > wrapLength
			) {
			pos = pos % wrapLength;
		}

/*
		const nsIDOMKeyEvents = Components.interfaces.nsIDOMKeyEvents;
		const nsISelectionListener = Components.interfaces.nsISelectionListener;
		if (
			aReason &&
			aReason & nsISelectionListener.KEYPRESS_REASON &&
			!(aReason & nsISelectionListener.SELECTALL_REASON)
			) {
			if (this.lastKeyCode == nsIDOMKeyEvents.DOM_VK_LEFT) {
				if (lastPos != 0) {
					pos =
				}
				else {
				}
			}
		}
*/

		if (pos in marks)
			marks[pos].setAttribute(this.kCURSOR, true);

		this._updating = false;
	},
	_updating : false,
	
	getCurrentLine : function(aSelection) 
	{
		var node = aSelection.focusNode;
		var left = (node.nodeValue || '').substring(0, aSelection.focusOffset);
		var right = (node.nodeValue || '').substring(aSelection.focusOffset+1);

		var walker = node.ownerDocument.createTreeWalker(
				node.ownerDocument,
				NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
				this,
				false
			);

		walker.currentNode = aSelection.focusNode;
		while (
			(node = walker.previousNode()) &&
			!this.isBody(node) &&
			!this.isBR(node)
			)
		{
			left = (node.nodeValue || '') + left;
		}
		left = left.split(/[\n\r]+/);
		left = left[left.length-1];

		walker.currentNode = aSelection.focusNode;
		while (
			(node = walker.nextNode()) &&
			!this.isBody(node) &&
			!this.isBR(node)
			)
		{
			right += (node.nodeValue || '');
		}
		right = right.split(/[\n\r]+/);
		right = right[0];

		return {
			left       : left,
			leftCount  : this.countCharacters(left),
			right      : right,
			rightCount : this.countCharacters(right)
		};
	},
	
	countCharcters : function(aString) 
	{
		var count;
		var char;
		for (var i = 0, maxi = aString.length; i < maxi; i++)
		{
			char = aString.charCodeAt(i);
			if (char == 9) { // Tab
				count += this.tabWidth;
			}
			else if (char >=  0 && char <= 127) { // ASCII
				count++;
			}
			else {
				count += this.nonAsciiWidth;
			}
		}
		return count;
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
				if (aPrefName.indexOf('font.size.') == 0)
					this.reset();
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
		if (this.bar) this.reset();
	},
	domains : [
		'extensions.rulerbar.',
		'mailnews.wraplength',
		'font.size.'
	]
  
}; 

window.addEventListener('DOMContentLoaded', RulerBar, false);
  
