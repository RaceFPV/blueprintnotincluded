import { Component, OnInit, ViewChild } from "@angular/core";
declare var PIXI: any;
import { SpriteModifier } from '../../../lib/src/drawing/sprite-modifier';
import { SpriteInfo } from '../../../lib/src/drawing/sprite-info';

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"],
})
export class AppComponent implements OnInit {
  title = "blueprintnotincluded";

  ngOnInit() {
    // Add global unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      // Check if this is a PIXI/image loading error
      if (event.reason &&
          (event.reason.target instanceof HTMLImageElement ||
           event.reason.type === 'error' ||
           (event.reason.message && event.reason.message.includes('texture')))) {
        console.warn('[Global] Handled image loading promise rejection:', event.reason);
        // Prevent the error from being logged to console as unhandled
        event.preventDefault();
      } else {
        // Log other unhandled promise rejections normally
        console.error('[Global] Unhandled promise rejection:', event.reason);
      }
    });

    SpriteModifier.init();
    SpriteInfo.init();
    // ... rest of initialization
  }
}
