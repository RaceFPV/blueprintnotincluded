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
    SpriteModifier.init();
    SpriteInfo.init();
    // ... rest of initialization
  }
}
