import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ReviewService } from './review.service';

describe('ReviewService', () => {
  let service: ReviewService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReviewService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('approve', () => {
    it('sin edicion: body vacio', () => {
      service.approve('int-1').subscribe();

      const req = httpMock.expectOne('/api/interactions/int-1/approve');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({ status: 'ok', action_type: 'AUTO_PUBLISH' });
    });

    it('con edicion: manda edited_response y nunca reviewed_by', () => {
      service.approve('int-1', 'Texto editado').subscribe();

      const req = httpMock.expectOne('/api/interactions/int-1/approve');
      expect(req.request.body).toEqual({ edited_response: 'Texto editado' });
      req.flush({ status: 'ok', action_type: 'AUTO_PUBLISH' });
    });

    it('editedResponse null (identico al generado): se omite del body, igual que si no viniera', () => {
      service.approve('int-1', null).subscribe();

      const req = httpMock.expectOne('/api/interactions/int-1/approve');
      expect(req.request.body).toEqual({});
      req.flush({ status: 'ok', action_type: 'AUTO_PUBLISH' });
    });
  });

  describe('regenerate', () => {
    it('manda solo rejection_reason, nunca reviewed_by', () => {
      service.regenerate('int-1', 'Falta contexto').subscribe();

      const req = httpMock.expectOne('/api/interactions/int-1/regenerate');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ rejection_reason: 'Falta contexto' });
      req.flush({ status: 'ok', action_type: 'AUTO_PUBLISH' });
    });
  });

  describe('discard', () => {
    it('sin motivo: body vacio, nunca manda un campo de revisor', () => {
      service.discard('int-1', undefined).subscribe();

      const req = httpMock.expectOne('/api/interactions/int-1/discard');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({ status: 'ok', action_type: 'DISCARDED' });
    });

    it('con motivo: lo manda en rejection_reason', () => {
      service.discard('int-1', 'No corresponde').subscribe();

      const req = httpMock.expectOne('/api/interactions/int-1/discard');
      expect(req.request.body).toEqual({ rejection_reason: 'No corresponde' });
      req.flush({ status: 'ok', action_type: 'DISCARDED' });
    });
  });
});
