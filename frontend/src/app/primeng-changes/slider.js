"use strict";
var __decorate =
  (this && this.__decorate) ||
  function (decorators, target, key, desc) {
    var c = arguments.length,
      r =
        c < 3
          ? target
          : desc === null
          ? (desc = Object.getOwnPropertyDescriptor(target, key))
          : desc,
      d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
      r = Reflect.decorate(decorators, target, key, desc);
    else
      for (var i = decorators.length - 1; i >= 0; i--)
        if ((d = decorators[i]))
          r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  };
var __metadata =
  (this && this.__metadata) ||
  function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
      return Reflect.metadata(k, v);
  };
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("@angular/core");
var common_1 = require("@angular/common");
var domhandler_1 = require("../dom/domhandler");
var forms_1 = require("@angular/forms");
exports.SLIDER_VALUE_ACCESSOR = {
  provide: forms_1.NG_VALUE_ACCESSOR,
  useExisting: core_1.forwardRef(function () {
    return Slider;
  }),
  multi: true,
};
var Slider = /** @class */ (function () {
  function Slider(el, renderer, ngZone, cd) {
    this.el = el;
    this.renderer = renderer;
    this.ngZone = ngZone;
    this.cd = cd;
    this.min = 0;
    this.max = 100;
    this.orientation = "horizontal";
    this.tabindex = 0;
    this.onChange = new core_1.EventEmitter();
    this.onSlideEnd = new core_1.EventEmitter();
    this.handleValues = [];
    this.onModelChange = function () {};
    this.onModelTouched = function () {};
    this.handleIndex = 0;
  }
  Slider.prototype.onMouseDown = function (event, index) {
    if (this.disabled) {
      return;
    }
    this.dragging = true;
    this.updateDomData();
    this.sliderHandleClick = true;
    this.handleIndex = index;
    this.bindDragListeners();
    event.target.focus();
    event.preventDefault();
  };
  Slider.prototype.onTouchStart = function (event, index) {
    if (this.disabled) {
      return;
    }
    var touchobj = event.changedTouches[0];
    this.startHandleValue = this.range
      ? this.handleValues[index]
      : this.handleValue;
    this.dragging = true;
    this.handleIndex = index;
    if (this.orientation === "horizontal") {
      this.startx = parseInt(touchobj.clientX, 10);
      this.barWidth = this.el.nativeElement.children[0].offsetWidth;
    } else {
      this.starty = parseInt(touchobj.clientY, 10);
      this.barHeight = this.el.nativeElement.children[0].offsetHeight;
    }
    event.preventDefault();
  };
  Slider.prototype.onTouchMove = function (event, index) {
    if (this.disabled) {
      return;
    }
    var touchobj = event.changedTouches[0],
      handleValue = 0;
    if (this.orientation === "horizontal") {
      handleValue =
        Math.floor(
          ((parseInt(touchobj.clientX, 10) - this.startx) * 100) / this.barWidth
        ) + this.startHandleValue;
    } else {
      handleValue =
        Math.floor(
          ((this.starty - parseInt(touchobj.clientY, 10)) * 100) /
            this.barHeight
        ) + this.startHandleValue;
    }
    this.setValueFromHandle(event, handleValue);
    event.preventDefault();
  };
  Slider.prototype.onTouchEnd = function (event, index) {
    if (this.disabled) {
      return;
    }
    this.dragging = false;
    if (this.range)
      this.onSlideEnd.emit({ originalEvent: event, values: this.values });
    else this.onSlideEnd.emit({ originalEvent: event, value: this.value });
    event.preventDefault();
  };
  Slider.prototype.onBarClick = function (event) {
    if (this.disabled) {
      return;
    }
    if (!this.sliderHandleClick) {
      this.updateDomData();
      this.handleChange(event);
    }
    this.sliderHandleClick = false;
  };
  Slider.prototype.onHandleKeydown = function (event, handleIndex) {
    if (event.which == 38 || event.which == 39) {
      this.spin(event, 1, handleIndex);
    } else if (event.which == 37 || event.which == 40) {
      this.spin(event, -1, handleIndex);
    }
  };
  Slider.prototype.spin = function (event, dir, handleIndex) {
    var step = (this.step || 1) * dir;
    if (this.range) {
      this.handleIndex = handleIndex;
      this.updateValue(this.values[this.handleIndex] + step);
      this.updateHandleValue();
    } else {
      this.updateValue(this.value + step);
      this.updateHandleValue();
    }
    event.preventDefault();
  };
  Slider.prototype.handleChange = function (event) {
    var handleValue = this.calculateHandleValue(event);
    this.setValueFromHandle(event, handleValue);
  };
  Slider.prototype.bindDragListeners = function () {
    var _this = this;
    this.ngZone.runOutsideAngular(function () {
      if (!_this.dragListener) {
        _this.dragListener = _this.renderer.listen(
          "document",
          "mousemove",
          function (event) {
            if (_this.dragging) {
              _this.ngZone.run(function () {
                _this.handleChange(event);
              });
            }
          }
        );
      }
      if (!_this.mouseupListener) {
        _this.mouseupListener = _this.renderer.listen(
          "document",
          "mouseup",
          function (event) {
            if (_this.dragging) {
              _this.dragging = false;
              _this.ngZone.run(function () {
                if (_this.range) {
                  _this.onSlideEnd.emit({
                    originalEvent: event,
                    values: _this.values,
                  });
                } else {
                  _this.onSlideEnd.emit({
                    originalEvent: event,
                    value: _this.value,
                  });
                }
              });
            }
          }
        );
      }
    });
  };
  Slider.prototype.unbindDragListeners = function () {
    if (this.dragListener) {
      this.dragListener();
    }
    if (this.mouseupListener) {
      this.mouseupListener();
    }
  };
  Slider.prototype.setValueFromHandle = function (event, handleValue) {
    var newValue = this.getValueFromHandle(handleValue);
    if (this.range) {
      if (this.step) {
        this.handleStepChange(newValue, this.values[this.handleIndex]);
      } else if (this.customStep) {
        this.handleCustomStepChange(newValue, this.value);
      } else {
        this.handleValues[this.handleIndex] = handleValue;
        this.updateValue(newValue, event);
      }
    } else {
      if (this.step) {
        this.handleStepChange(newValue, this.value);
      } else if (this.customStep) {
        this.handleCustomStepChange(newValue, this.value);
      } else {
        this.handleValue = handleValue;
        this.updateValue(newValue, event);
      }
    }
  };
  Slider.prototype.handleStepChange = function (newValue, oldValue) {
    var diff = newValue - oldValue;
    var val = oldValue;
    if (diff < 0) {
      val =
        oldValue +
        Math.ceil(newValue / this.step - oldValue / this.step) * this.step;
    } else if (diff > 0) {
      val =
        oldValue +
        Math.floor(newValue / this.step - oldValue / this.step) * this.step;
    }
    this.updateValue(val);
    this.updateHandleValue();
  };
  Slider.prototype.handleCustomStepChange = function (newValue, oldValue) {
    var val = oldValue;
    for (var customStepValue of this.customStep) {
      let diffOld = Math.abs(val - customStepValue);
      let diffNew = Math.abs(newValue - customStepValue);

      if (diffNew < diffOld) val = customStepValue;
    }
    this.updateValue(val);
    this.updateHandleValue();
  };
  Slider.prototype.writeValue = function (value) {
    if (this.range) this.values = value || [0, 0];
    else this.value = value || 0;
    this.updateHandleValue();
    this.cd.markForCheck();
  };
  Slider.prototype.registerOnChange = function (fn) {
    this.onModelChange = fn;
  };
  Slider.prototype.registerOnTouched = function (fn) {
    this.onModelTouched = fn;
  };
  Slider.prototype.setDisabledState = function (val) {
    this.disabled = val;
  };
  Object.defineProperty(Slider.prototype, "rangeStartLeft", {
    get: function () {
      return this.isVertical() ? "auto" : this.handleValues[0] + "%";
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(Slider.prototype, "rangeStartBottom", {
    get: function () {
      return this.isVertical() ? this.handleValues[0] + "%" : "auto";
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(Slider.prototype, "rangeEndLeft", {
    get: function () {
      return this.isVertical() ? "auto" : this.handleValues[1] + "%";
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(Slider.prototype, "rangeEndBottom", {
    get: function () {
      return this.isVertical() ? this.handleValues[1] + "%" : "auto";
    },
    enumerable: true,
    configurable: true,
  });
  Slider.prototype.isVertical = function () {
    return this.orientation === "vertical";
  };
  Slider.prototype.updateDomData = function () {
    var rect = this.el.nativeElement.children[0].getBoundingClientRect();
    this.initX = rect.left + domhandler_1.DomHandler.getWindowScrollLeft();
    this.initY = rect.top + domhandler_1.DomHandler.getWindowScrollTop();
    this.barWidth = this.el.nativeElement.children[0].offsetWidth;
    this.barHeight = this.el.nativeElement.children[0].offsetHeight;
  };
  Slider.prototype.calculateHandleValue = function (event) {
    if (this.orientation === "horizontal")
      return ((event.pageX - this.initX) * 100) / this.barWidth;
    else
      return (
        ((this.initY + this.barHeight - event.pageY) * 100) / this.barHeight
      );
  };
  Slider.prototype.updateHandleValue = function () {
    if (this.range) {
      this.handleValues[0] =
        ((this.values[0] < this.min ? 0 : this.values[0] - this.min) * 100) /
        (this.max - this.min);
      this.handleValues[1] =
        ((this.values[1] > this.max ? 100 : this.values[1] - this.min) * 100) /
        (this.max - this.min);
    } else {
      if (this.value < this.min) this.handleValue = 0;
      else if (this.value > this.max) this.handleValue = 100;
      else
        this.handleValue =
          ((this.value - this.min) * 100) / (this.max - this.min);
    }
  };
  Slider.prototype.updateValue = function (val, event) {
    if (this.range) {
      var value = val;
      if (this.handleIndex == 0) {
        if (value < this.min) {
          value = this.min;
          this.handleValues[0] = 0;
        } else if (value > this.values[1]) {
          value = this.values[1];
          this.handleValues[0] = this.handleValues[1];
        }
        this.sliderHandleStart.nativeElement.focus();
      } else {
        if (value > this.max) {
          value = this.max;
          this.handleValues[1] = 100;
        } else if (value < this.values[0]) {
          value = this.values[0];
          this.handleValues[1] = this.handleValues[0];
        }
        this.sliderHandleEnd.nativeElement.focus();
      }
      this.values[this.handleIndex] = this.getNormalizedValue(value);
      this.onModelChange(this.values);
      this.onChange.emit({ event: event, values: this.values });
    } else {
      if (val < this.min) {
        val = this.min;
        this.handleValue = 0;
      } else if (val > this.max) {
        val = this.max;
        this.handleValue = 100;
      }
      this.value = this.getNormalizedValue(val);
      this.onModelChange(this.value);
      this.onChange.emit({ event: event, value: this.value });
      this.sliderHandle.nativeElement.focus();
    }
  };
  Slider.prototype.getValueFromHandle = function (handleValue) {
    return (this.max - this.min) * (handleValue / 100) + this.min;
  };
  Slider.prototype.getDecimalsCount = function (value) {
    if (value && Math.floor(value) !== value)
      return value.toString().split(".")[1].length || 0;
    return 0;
  };
  Slider.prototype.getNormalizedValue = function (val) {
    var decimalsCount = this.getDecimalsCount(this.step);
    if (decimalsCount > 0) {
      return +val.toFixed(decimalsCount);
    } else {
      return Math.floor(val);
    }
  };
  Slider.prototype.ngOnDestroy = function () {
    this.unbindDragListeners();
  };
  __decorate(
    [core_1.Input(), __metadata("design:type", Boolean)],
    Slider.prototype,
    "animate",
    void 0
  );
  __decorate(
    [core_1.Input(), __metadata("design:type", Boolean)],
    Slider.prototype,
    "disabled",
    void 0
  );
  __decorate(
    [core_1.Input(), __metadata("design:type", Number)],
    Slider.prototype,
    "min",
    void 0
  );
  __decorate(
    [core_1.Input(), __metadata("design:type", Number)],
    Slider.prototype,
    "max",
    void 0
  );
  __decorate(
    [core_1.Input(), __metadata("design:type", String)],
    Slider.prototype,
    "orientation",
    void 0
  );
  __decorate(
    [core_1.Input(), __metadata("design:type", Number)],
    Slider.prototype,
    "step",
    void 0
  );
  __decorate(
    [core_1.Input(), __metadata("design:type", Array[Number])],
    Slider.prototype,
    "customStep",
    void 0
  );
  __decorate(
    [core_1.Input(), __metadata("design:type", Boolean)],
    Slider.prototype,
    "range",
    void 0
  );
  __decorate(
    [core_1.Input(), __metadata("design:type", Object)],
    Slider.prototype,
    "style",
    void 0
  );
  __decorate(
    [core_1.Input(), __metadata("design:type", String)],
    Slider.prototype,
    "styleClass",
    void 0
  );
  __decorate(
    [core_1.Input(), __metadata("design:type", Number)],
    Slider.prototype,
    "tabindex",
    void 0
  );
  __decorate(
    [core_1.Output(), __metadata("design:type", core_1.EventEmitter)],
    Slider.prototype,
    "onChange",
    void 0
  );
  __decorate(
    [core_1.Output(), __metadata("design:type", core_1.EventEmitter)],
    Slider.prototype,
    "onSlideEnd",
    void 0
  );
  __decorate(
    [
      core_1.ViewChild("sliderHandle", { static: false }),
      __metadata("design:type", core_1.ElementRef),
    ],
    Slider.prototype,
    "sliderHandle",
    void 0
  );
  __decorate(
    [
      core_1.ViewChild("sliderHandleStart", { static: false }),
      __metadata("design:type", core_1.ElementRef),
    ],
    Slider.prototype,
    "sliderHandleStart",
    void 0
  );
  __decorate(
    [
      core_1.ViewChild("sliderHandleEnd", { static: false }),
      __metadata("design:type", core_1.ElementRef),
    ],
    Slider.prototype,
    "sliderHandleEnd",
    void 0
  );
  Slider = __decorate(
    [
      core_1.Component({
        selector: "p-slider",
        template:
          '\n        <div [ngStyle]="style" [class]="styleClass" [ngClass]="{\'ui-slider ui-widget ui-widget-content ui-corner-all\':true,\'ui-state-disabled\':disabled,\n            \'ui-slider-horizontal\':orientation == \'horizontal\',\'ui-slider-vertical\':orientation == \'vertical\',\'ui-slider-animate\':animate}"\n            (click)="onBarClick($event)">\n            <span *ngIf="range && orientation == \'horizontal\'" class="ui-slider-range ui-widget-header ui-corner-all" [ngStyle]="{\'left\':handleValues[0] + \'%\',width: (handleValues[1] - handleValues[0] + \'%\')}"></span>\n            <span *ngIf="range && orientation == \'vertical\'" class="ui-slider-range ui-widget-header ui-corner-all" [ngStyle]="{\'bottom\':handleValues[0] + \'%\',height: (handleValues[1] - handleValues[0] + \'%\')}"></span>\n            <span *ngIf="!range && orientation==\'vertical\'" class="ui-slider-range ui-slider-range-min ui-widget-header ui-corner-all" [ngStyle]="{\'height\': handleValue + \'%\'}"></span>\n            <span *ngIf="!range && orientation==\'horizontal\'" class="ui-slider-range ui-slider-range-min ui-widget-header ui-corner-all" [ngStyle]="{\'width\': handleValue + \'%\'}"></span>\n            <span #sliderHandle *ngIf="!range" [attr.tabindex]="tabindex" (keydown)="onHandleKeydown($event)" class="ui-slider-handle ui-state-default ui-corner-all ui-clickable" (mousedown)="onMouseDown($event)" (touchstart)="onTouchStart($event)" (touchmove)="onTouchMove($event)" (touchend)="onTouchEnd($event)"\n                [style.transition]="dragging ? \'none\': null" [ngStyle]="{\'left\': orientation == \'horizontal\' ? handleValue + \'%\' : null,\'bottom\': orientation == \'vertical\' ? handleValue + \'%\' : null}"></span>\n            <span #sliderHandleStart *ngIf="range" [attr.tabindex]="tabindex" (keydown)="onHandleKeydown($event,0)" (mousedown)="onMouseDown($event,0)" (touchstart)="onTouchStart($event,0)" (touchmove)="onTouchMove($event,0)" (touchend)="onTouchEnd($event)" [style.transition]="dragging ? \'none\': null" class="ui-slider-handle ui-state-default ui-corner-all ui-clickable" \n                [ngStyle]="{\'left\': rangeStartLeft, \'bottom\': rangeStartBottom}" [ngClass]="{\'ui-slider-handle-active\':handleIndex==0}"></span>\n            <span #sliderHandleEnd *ngIf="range" [attr.tabindex]="tabindex" (keydown)="onHandleKeydown($event,1)" (mousedown)="onMouseDown($event,1)" (touchstart)="onTouchStart($event,1)" (touchmove)="onTouchMove($event,1)" (touchend)="onTouchEnd($event)" [style.transition]="dragging ? \'none\': null" class="ui-slider-handle ui-state-default ui-corner-all ui-clickable" \n                [ngStyle]="{\'left\': rangeEndLeft, \'bottom\': rangeEndBottom}" [ngClass]="{\'ui-slider-handle-active\':handleIndex==1}"></span>\n        </div>\n    ',
        providers: [exports.SLIDER_VALUE_ACCESSOR],
      }),
      __metadata("design:paramtypes", [
        core_1.ElementRef,
        core_1.Renderer2,
        core_1.NgZone,
        core_1.ChangeDetectorRef,
      ]),
    ],
    Slider
  );
  return Slider;
})();
exports.Slider = Slider;
var SliderModule = /** @class */ (function () {
  function SliderModule() {}
  SliderModule = __decorate(
    [
      core_1.NgModule({
        imports: [common_1.CommonModule],
        exports: [Slider],
        declarations: [Slider],
      }),
    ],
    SliderModule
  );
  return SliderModule;
})();
exports.SliderModule = SliderModule;
//# sourceMappingURL=slider.js.map
