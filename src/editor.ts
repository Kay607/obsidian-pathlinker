import {
    ViewUpdate,
    PluginValue,
    EditorView,
    ViewPlugin,
  } from '@codemirror/view';
  
  class PathLinkerViewPlugin implements PluginValue {
    constructor(view: EditorView) {
      // ...
    }
  
    update(update: ViewUpdate) {
      // ...
    }
  
    destroy() {
      // ...
    }
  }