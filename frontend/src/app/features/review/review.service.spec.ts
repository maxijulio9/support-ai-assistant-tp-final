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
    it('sin reviewedBy y sin edicion: body vacio (mismo comportamiento de siempre)', () => {
      service.approve('int-1', undefined).subscribe();

      const req = httpMock.expectOne('/api/interactions/int-1/approve');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({ status: 'ok', action_type: 'AUTO_PUBLISH' });
    });

    it('con edicion: suma edited_response al body', () => {
      service.approve('int-1', undefined, 'Texto editado').subscribe();

      const req = httpMock.expectOne('/api/interactions/int-1/approve');
      expect(req.request.body).toEqual({ edited_response: 'Texto editado' });
      req.flush({ status: 'ok', action_type: 'AUTO_PUBLISH' });
    });

    it('con reviewedBy y edicion: ambos campos en el body', () => {
      service.approve('int-1', 'uuid-123', 'Texto editado').subscribe();

      const req = httpMock.expectOne('/api/interactions/int-1/approve');
      expect(req.request.body).toEqual({ reviewed_by: 'uuid-123', edited_response: 'Texto editado' });
      req.flush({ status: 'ok', action_type: 'AUTO_PUBLISH' });
    });

    it('editedResponse null (identico al generado): se omite del body, igual que si no viniera', () => {
      service.approve('int-1', undefined, null).subscribe();

      const req = httpMock.expectOne('/api/interactions/int-1/approve');
      expect(req.request.body).toEqual({});
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
