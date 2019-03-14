import { HttpClientTestingModule } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";

import { SettingsInitializerService } from "./settings-initializer.service";
import { SettingsService } from "./settings.service";

describe("SettingsInitializerService", () => {
    beforeEach(() =>
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [SettingsService],
        }),
    );

    it("should be created", () => {
        const service: SettingsInitializerService = TestBed.get(SettingsInitializerService);
        expect(service).toBeTruthy();
    });
});
