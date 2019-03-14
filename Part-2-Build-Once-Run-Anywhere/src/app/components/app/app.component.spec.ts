import { async, TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { SettingsService } from "../../services/settings.service";
import { AppComponent } from "./app.component";

describe("AppComponent", () => {
    beforeEach(async(() => {
        const settingsService: SettingsService = new SettingsService();
        settingsService.settings = { baseUrl: "foo" };

        TestBed.configureTestingModule({
            imports: [RouterTestingModule],
            declarations: [AppComponent],
            providers: [
                {
                    provide: SettingsService,
                    useValue: settingsService,
                },
            ],
        }).compileComponents();
    }));

    it("should create the app", () => {
        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.debugElement.componentInstance;
        expect(app).toBeTruthy();
    });

    it(`should have as title 'dockerized-app'`, () => {
        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.debugElement.componentInstance;
        expect(app.title).toEqual("dockerized-app");
    });

    it("should render title in a h1 tag", () => {
        const fixture = TestBed.createComponent(AppComponent);
        fixture.detectChanges();
        const compiled = fixture.debugElement.nativeElement;
        expect(compiled.querySelector("h1").textContent).toContain("Welcome to dockerized-app!");
    });
});
