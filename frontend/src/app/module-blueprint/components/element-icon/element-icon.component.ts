@Component({
  selector: 'app-element-icon',
  template: `
    <img
      *ngIf="element"
      [src]="getElementImagePath()"
      [width]="width"
      [height]="height"
      (error)="handleImageError($event)"
    >
  `
})
export class ElementIconComponent {
  @Input() element: BuildableElement;
  @Input() width: string = '40px';
  @Input() height: string = '40px';

  getElementImagePath(): string {
    if (!this.element) return '';
    // Use the correct path for assets in the Docker container
    return `/assets/images/${this.element.id}_0.png`;
  }

  handleImageError(event: any) {
    console.warn(`Failed to load image for element: ${this.element?.id}`);
    // Optionally set a fallback image
    event.target.src = '/assets/images/fallback.png';
  }
}
