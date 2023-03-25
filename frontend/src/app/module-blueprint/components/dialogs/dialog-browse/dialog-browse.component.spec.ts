import { DatePipe } from "@angular/common";
import { waitForAsync, ComponentFixture, TestBed } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { RouterTestingModule } from "@angular/router/testing";

import { DialogBrowseComponent } from "./dialog-browse.component";
import { AuthenticationService } from "src/app/module-blueprint/services/authentification-service";

xdescribe("DialogBrowseComponent", () => {
  let component: DialogBrowseComponent;
  let fixture: ComponentFixture<DialogBrowseComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientModule, RouterTestingModule.withRoutes([])],
      declarations: [DialogBrowseComponent],
      providers: [AuthenticationService, DatePipe],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DialogBrowseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
