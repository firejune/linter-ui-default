/* @flow */

import { CompositeDisposable, Emitter } from 'atom'
import debounce from 'sb-debounce'
import disposableEvent from 'disposable-event'
import { calculateDecorations } from './helpers'
import type { LinterMessage, TreeViewHighlight } from '../types'

class TreeView {
  emitter: Emitter
  messages: Array<LinterMessage>
  decorations: Object
  subscriptions: CompositeDisposable
  decorateOnTreeView: 'Files and Directories' | 'Files' | 'None'

  constructor() {
    this.emitter = new Emitter()
    this.messages = []
    this.decorations = {}
    this.subscriptions = new CompositeDisposable()

    this.subscriptions.add(this.emitter)
    this.subscriptions.add(
      atom.config.observe('linter-ui-default.decorateOnTreeView', decorateOnTreeView => {
        if (typeof this.decorateOnTreeView === 'undefined') {
          this.decorateOnTreeView = decorateOnTreeView
        } else if (decorateOnTreeView === 'None') {
          this.update([])
          this.decorateOnTreeView = decorateOnTreeView
        } else {
          const messages = this.messages
          this.decorateOnTreeView = decorateOnTreeView
          this.update(messages)
        }
      }),
    )

    setTimeout(() => {
      const element = TreeView.getElement()
      if (!element) {
        return
      }
      // Subscription is only added if the CompositeDisposable hasn't been disposed
      this.subscriptions.add(
        disposableEvent(
          element,
          'click',
          debounce(() => {
            this.update()
          }),
        ),
      )
    }, 100)
  }
  update(givenMessages: ?Array<LinterMessage> = null) {
    if (Array.isArray(givenMessages)) {
      this.messages = givenMessages
    }
    const messages = this.messages

    const element = TreeView.getElement()
    const decorateOnTreeView = this.decorateOnTreeView
    if (!element || decorateOnTreeView === 'None') {
      return
    }

    this.applyDecorations(calculateDecorations(decorateOnTreeView, messages))
  }
  applyDecorations(decorations: Object) {
    const treeViewElement = TreeView.getElement()
    if (!treeViewElement) {
      return
    }

    const elementCache = {}
    const appliedDecorations = {}

    Object.keys(this.decorations).forEach(filePath => {
      if (!{}.hasOwnProperty.call(this.decorations, filePath)) {
        return
      }
      if (!decorations[filePath]) {
        // Removed
        const elements =
          elementCache[filePath] || (elementCache[filePath] = TreeView.getElementsByPath(treeViewElement, filePath))
        if (elements.length) {
          this.removeDecoration(elements)
        }
      }
    })

    Object.keys(decorations).forEach(filePath => {
      if (!{}.hasOwnProperty.call(decorations, filePath)) {
        return
      }
      const elements =
        elementCache[filePath] || (elementCache[filePath] = TreeView.getElementsByPath(treeViewElement, filePath))
      if (elements) {
        this.handleDecoration(elements, !!this.decorations[filePath], decorations[filePath])
        appliedDecorations[filePath] = decorations[filePath]
      }
    })

    this.decorations = appliedDecorations
  }
  setDecorationsStyle(decorations: HTMLElement[], className?: string) {
    for (const decoration of decorations) {
      if (className) {
        decoration.classList.add(className)
      } else if (decoration) {
        decoration.className = ''
      }
    }
  }

  handleDecoration(elements: HTMLElement[], update: boolean = false, highlights: TreeViewHighlight) {
    const decorations = []
    if (update) {
      for (const element of elements) {
        decorations.push(element.querySelector('linter-decoration'))
      }
    }
    if (decorations.length) {
      this.setDecorationsStyle(decorations)
    } else {
      const decoration = document.createElement('linter-decoration')
      for (const element of elements) {
        const clone = decoration.cloneNode()
        element.appendChild(clone)
        decorations.push(clone)
      }
    }

    if (highlights.error) {
      this.setDecorationsStyle(decorations, 'linter-error')
    } else if (highlights.warning) {
      this.setDecorationsStyle(decorations, 'linter-warning')
    } else if (highlights.info) {
      this.setDecorationsStyle(decorations, 'linter-info')
    }
  }
  removeDecoration(elements: HTMLElement[]) {
    for (const element of elements) {
      const decoration = element.querySelector('linter-decoration')
      decoration.remove()
    }
  }
  dispose() {
    this.subscriptions.dispose()
  }
  static getElement() {
    return document.querySelector('.tree-view')
  }
  static getElementByPath(parent: HTMLElement, filePath: string): ?HTMLElement {
    return parent.querySelector(`[data-path=${CSS.escape(filePath)}]`)
  }
  static getElementsByPath(parent: HTMLElement, filePath: string): HTMLElement[] {
    const parts = filePath.split('/')
    const elements = []

    for (let i = 0; i < parts.length; i++) {
      const parentPath = parts.slice(0, parts.length - i).join('/')
      const parentElement = TreeView.getElementByPath(parent, parentPath)
      if (parentElement) {
        elements.push(parentElement)
      } else {
        break
      }
    }
    
    elements.pop()

    return elements
  }
}

module.exports = TreeView
