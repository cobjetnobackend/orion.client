/*******************************************************************************
 * @license
 * Copyright (c) 2014 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
/*global define*/
/*jslint browser:true*/

define([
	'orion/objects',
	'orion/webui/littlelib',
	'text!orion/widgets/input/ComboTextInput.html',
	'i18n!orion/widgets/nls/messages',
	'orion/inputCompletion/inputCompletion'
], function(objects, lib, ComboTextInputTemplate, messages, InputCompletion) {

	/**
	 * TODO add full docs
	 * Creates a text input box combined with:
	 * 1) [Optional] An attached button.
	 * 2) [Optional] Input completion based on recent entries.
	 * 
	 * @param {Object} options Contains the set of properties that describe this ComboTextInput.
	 * 		{Boolean} options.hasButton   true if this ComboTextInput should have an attached button, false otherwise
	 * 		{Boolean} options.hasInputCompletion   true if this ComboTextInput should create and use input completion, false otherwise
	 */
	function ComboTextInput(options){
		this._domNodeId = options.id;
		this._parentNode = options.parentNode;
		this._hasButton = options.hasButton;
		this._buttonText = options.buttonText;
		this._buttonClickListener = options.buttonClickListener;
		
		this._insertBeforeNode = options.insertBeforeNode;
				
		this._serviceRegistry = options.serviceRegistry;
		this._hasInputCompletion = options.hasInputCompletion;
		this._defaultRecentEntryProposalProvider = options.defaultRecentEntryProposalProvider;
		this._extendedRecentEntryProposalProvider = options.extendedRecentEntryProposalProvider;
		this._onRecentEntryDelete = options.onRecentEntryDelete;
		
		this._initializeDomNodes();
	}
	objects.mixin(ComboTextInput.prototype, {
		_initializeDomNodes: function() {
			var range = document.createRange();
			range.selectNode(this._parentNode);
			var domNodeFragment = range.createContextualFragment(ComboTextInputTemplate);
			
			// using a throw-away container to prevent the element from being added
			// to the page before any unnecessary subnodes have been removed from it
			var throwawayContainer = document.createElement("span"); //$NON-NLS-0$
			throwawayContainer.appendChild(domNodeFragment);
			this._domNode = throwawayContainer.lastChild;
			this._domNode.id = this._domNodeId;
			
			this._textInputNode = lib.$(".comboTextInputField", this._domNode); //$NON-NLS-0$
			this._textInputNode.addEventListener("focus", function() { //$NON-NLS-0$
				this._domNode.classList.add("comboTextInputWrapperFocussed"); //$NON-NLS-0$ 
			}.bind(this));
			
			this._textInputNode.addEventListener("blur", function() { //$NON-NLS-0$
				this._domNode.classList.remove("comboTextInputWrapperFocussed"); //$NON-NLS-0$ 
			}.bind(this));
			
			this._recentEntryButton = lib.$(".recentEntryButton", this._domNode); //$NON-NLS-0$
			if (this._hasInputCompletion) {
				this._initializeCompletion();
			} else {
				this._domNode.removeChild(this._recentEntryButton);
				this._recentEntryButton = undefined;
			}

			this._comboTextInputButton = lib.$(".comboTextInputButton", this._domNode); //$NON-NLS-0$
			if (this._hasButton) {
				this._comboTextInputButton = lib.$(".comboTextInputButton", this._domNode); //$NON-NLS-0$
				if (this._buttonText) {
					this._comboTextInputButton.appendChild(document.createTextNode(this._buttonText));	
				}
				if (this._buttonClickListener) {
					this._comboTextInputButton.addEventListener("click", function(event){
						this._buttonClickListener(event);
					}.bind(this)); //$NON-NLS-0$
				}
			} else {
				this._domNode.removeChild(this._comboTextInputButton);
				this._comboTextInputButton = undefined;
			}
			
			if (this._insertBeforeNode) {
				this._parentNode.insertBefore(this._domNode, this._insertBeforeNode);
			} else {
				this._parentNode.appendChild(this._domNode);
			}
		},
		
		_initializeCompletion: function() {
			this._localStorageKey = this._domNodeId + "LocalStorageKey"; //$NON-NLS-0$
			
			if (!this._defaultRecentEntryProposalProvider) {
				this._defaultRecentEntryProposalProvider = function(uiCallback) {
					var recentEntryString = localStorage.getItem(this._localStorageKey);
					var recentEntryArray = [];
					if (recentEntryString) {
						recentEntryArray = JSON.parse(recentEntryString);
					}
					uiCallback(recentEntryArray);
				}.bind(this);
			}
			
			if (!this._onRecentEntryDelete) {
				this._onRecentEntryDelete = function(item, evtTarget) {
					var recentEntryString = localStorage.getItem(this._localStorageKey);
					var recentEntryArray = JSON.parse(recentEntryString);
					
					//look for the item in the recentEntryArray
					var indexOfElement = this._getIndexOfValue(recentEntryArray, item);
					
					if (-1 < indexOfElement) {
						//found the item in the array, remove it and update localStorage
						recentEntryArray.splice(indexOfElement, 1);
						recentEntryString = JSON.stringify(recentEntryArray);
						localStorage.setItem(this._localStorageKey, recentEntryString);
						
						if(evtTarget) {
							window.setTimeout(function() {
								evtTarget.dispatchEvent({type:"inputDataListChanged", deleting: true}); //$NON-NLS-0$
							}.bind(this), 20);
						}
					}
				}.bind(this);
			}
			
			//Create and hook up the inputCompletion instance with the search box dom node.
			//The defaultProposalProvider provides proposals from the recent and saved searches.
			//The exendedProposalProvider provides proposals from plugins.
			this._inputCompletion = new InputCompletion.InputCompletion(this._textInputNode, this._defaultRecentEntryProposalProvider, {
				serviceRegistry: this._serviceRegistry, 
				group: this._domNodeId + "InputCompletion", //$NON-NLS-0$
				extendedProvider: this._extendedRecentEntryProposalProvider, 
				onDelete: this._onRecentEntryDelete,
				deleteToolTips: messages['Click or use delete key to delete the search term'] //$NON-NLS-0$
			});

			this._recentEntryButton.addEventListener("click", function(event){
				this._textInputNode.focus();
				this._inputCompletion._proposeOn();
				lib.stop(event);
			}.bind(this));
	    },
		
		getDomNode: function() {
			return this._domNode;
		},
		
		getTextInputNode: function() {
			return this._textInputNode;
		},
		
		getTextInputValue: function() {
			return this._textInputNode.value;	
		},
		
		setTextInputValue: function(value) {
			this._textInputNode.value = value;	
		},

		getButton: function() {
			return this._comboTextInputButton;	
		},
		
		getRecentEntryButton: function() {
			return this._recentEntryButton;
		},
		
		addTextInputValueToRecentEntries: function() {
			var value = this.getTextInputValue();
			if (value) {
				var recentEntryString = localStorage.getItem(this._localStorageKey);
				var recentEntryArray = [];
				
				if (recentEntryString) {
					recentEntryArray = JSON.parse(recentEntryString);
				}
				
				var indexOfElement = this._getIndexOfValue(recentEntryArray, value); //check if a duplicate entry exists
				if (-1 === indexOfElement) {
					//no duplicate entry found, add new entry to array
					recentEntryArray.push({
						type: "proposal", 
						label: value, 
						value: value
					});
					recentEntryString = JSON.stringify(recentEntryArray);
					localStorage.setItem(this._localStorageKey, recentEntryString);		
				}
			}
		},
		
		/**
		 * Looks for an entry in the specified recentEntryArray with 
		 * a value that is equivalent to the specified value parameter.
		 *  
		 * @returns The index of the matching entry in the array or -1 
		 */
		_getIndexOfValue: function(recentEntryArray, value) {
			var indexOfElement = -1;
			
			recentEntryArray.some(function(entry, index){
				if (entry.value === value) {
					indexOfElement = index;
					return true;
				}
				return false;
			});
			
			return indexOfElement;
		},
		
		showButton: function() {
			this._comboTextInputButton.classList.remove("isHidden"); //$NON-NLS-0$
		},
		
		hideButton: function() {
			this._comboTextInputButton.classList.add("isHidden"); //$NON-NLS-0$
		}
	});
	return ComboTextInput;
});
