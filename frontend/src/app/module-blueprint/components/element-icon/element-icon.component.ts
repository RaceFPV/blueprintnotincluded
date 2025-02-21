@Component({
  selector: 'app-element-icon',
  template: `
    <img
      *ngIf="element"
      [src]="getElementImagePath()"
      [width]="width"
      [height]="height"
    >
  `
})
export class ElementIconComponent {
  @Input() element: BuildableElement;
  @Input() width: string = '40px';
  @Input() height: string = '40px';

  getElementImagePath(): string {
    if (!this.element) return '';
    // Remove the ui prefix and use direct path
    return `assets/images/${this.element.id}_0.png`;
  }
}
