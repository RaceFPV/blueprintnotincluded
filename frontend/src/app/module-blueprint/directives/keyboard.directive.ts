import { Directive, HostListener } from "@angular/core";
import { ToolService } from "../services/tool-service";
import { ToolType } from "../common/tools/tool";

@Directive({
  selector: "[appKeyboard]",
})
export class KeyboardDirective {
  constructor(private toolService: ToolService) {}

  @HostListener("document:keydown", ["$event"])
  handleKeyboardEvent(event: KeyboardEvent) {
    // Ignore keyboard shortcuts if target is an input or if a dialog is open
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      document.querySelector(".p-dialog-visible")
    ) {
      // Check for visible PrimeNG dialog
      return;
    }

    switch (event.key.toLowerCase()) {
      case "b":
        this.toolService.changeTool(ToolType.build);
        break;
      // ... rest of your keyboard shortcuts
    }
  }
}
