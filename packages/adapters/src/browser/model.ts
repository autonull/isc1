import { EmbeddingModelAdapter } from '../interfaces/index.js';
import { pipeline, env } from '@huggingface/transformers';

class BrowserModelAdapter implements EmbeddingModelAdapter {
  private _pipeline: any = null;

  async load(modelId: string): Promise<void> {
    try {
      env.allowLocalModels = false;
      if (env.backends.onnx.wasm) {
        env.backends.onnx.wasm.numThreads = 1;
        env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0/dist/';
      }
      this._pipeline = await pipeline('feature-extraction', modelId);
    } catch (e) {
      console.error('Failed to load embedding model', e);
      throw e;
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this._pipeline) {
      throw new Error('Model not loaded');
    }

    try {
      const output = await this._pipeline(text, {
        pooling: 'mean',
        normalize: true
      });
      return Array.from(output.data);
    } catch (e) {
      console.error('Inference failed', e);
      throw e;
    }
  }

  async unload(): Promise<void> {
    this._pipeline = null;
  }
}

export const browserModel = new BrowserModelAdapter();
