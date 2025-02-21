import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AssetPreloaderService {
  private loadedAssets: Set<string> = new Set();

  constructor(private http: HttpClient) {}

  preloadImage(path: string): Promise<void> {
    if (this.loadedAssets.has(path)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.loadedAssets.add(path);
        resolve();
      };
      img.onerror = () => {
        console.warn(`Failed to preload image: ${path}`);
        reject();
      };
      img.src = path;
    });
  }

  async preloadGameAssets() {
    const baseImagePath = 'assets/images/';
    // Add your critical assets here
    const criticalAssets = [
      'manual/info-indicator-icon.png',
      'manual/liquid_icon.png',
      // ... add other critical assets
    ];

    try {
      await Promise.all(
        criticalAssets.map(asset => this.preloadImage(baseImagePath + asset))
      );
    } catch (error) {
      console.error('Error preloading assets:', error);
    }
  }
}
