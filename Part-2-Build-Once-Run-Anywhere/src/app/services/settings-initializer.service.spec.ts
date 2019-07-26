import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { Settings } from "../models/settings";

import { SettingsInitializerService } from "./settings-initializer.service";
import { SettingsService } from "./settings.service";

describe("SettingsInitializerService", () => {
    let service: SettingsInitializerService;
    let httpMock: HttpTestingController;
    let settingsService: SettingsService;

    const testSettings: Settings = {
        baseUrl: "baseUrl",
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
        });

        service = TestBed.get(SettingsInitializerService);
        httpMock = TestBed.get(HttpTestingController);
        settingsService = TestBed.get(SettingsService);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it("should be created", () => {
        expect(service).toBeTruthy();
    });

    it("should initialize settings new", (done) => {
        service.initializeSettings().then(() => {
            expect(settingsService.settings).toEqual(testSettings);
            done();
        });

        const request = httpMock.expectOne("assets/settings.json");
        expect(request.request.method).toBe("GET");
        request.flush(testSettings);
    });

    it("should not initialize settings if get settings.json failed", (done) => {
        service
            .initializeSettings()
            .then(() => {
                done.fail(new Error("this was expected to fail"));
            })
            .catch(() => {
                expect(settingsService.settings).toBeUndefined();
                done();
            });

        const request = httpMock.expectOne("assets/settings.json");
        expect(request.request.method).toBe("GET");
        request.flush(testSettings, { status: 500, statusText: "Some Weird Server Error" });
    });
});
