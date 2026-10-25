import { agreedThresholds } from './confidence-thresholds';
import { ProjectThresholdsWithActivity } from './project-thresholds-activity';

function project(id: string, autoPublish: number, needsReview: number, isActive?: boolean): ProjectThresholdsWithActivity {
  return {
    project_id: id,
    key: 'TARG',
    name: 'Proyecto',
    threshold_auto_publish: autoPublish,
    threshold_needs_review: needsReview,
    similarity_threshold: 0.4,
    first_response_target_seconds: 30,
    ...(isActive === undefined ? {} : { is_active: isActive }),
  };
}

describe('agreedThresholds', () => {
  it('sin proyectos: los dos umbrales son null', () => {
    const result = agreedThresholds([]);
    expect(result).toEqual({ thresholdAutoPublish: null, thresholdNeedsReview: null });
  });

  it('un solo proyecto: los dos umbrales son los de ese proyecto', () => {
    const result = agreedThresholds([project('p1', 0.9, 0.55)]);
    expect(result).toEqual({ thresholdAutoPublish: 0.9, thresholdNeedsReview: 0.55 });
  });

  it('varios proyectos, los dos umbrales coinciden: se devuelve el valor comun', () => {
    const result = agreedThresholds([project('p1', 0.9, 0.55), project('p2', 0.9, 0.55)]);
    expect(result).toEqual({ thresholdAutoPublish: 0.9, thresholdNeedsReview: 0.55 });
  });

  it('threshold_auto_publish difiere, threshold_needs_review coincide: cada uno se evalua por separado', () => {
    const result = agreedThresholds([project('p1', 0.9, 0.55), project('p2', 0.85, 0.55)]);
    expect(result).toEqual({ thresholdAutoPublish: null, thresholdNeedsReview: 0.55 });
  });

  it('los dos umbrales difieren entre proyectos: los dos quedan en null', () => {
    const result = agreedThresholds([project('p1', 0.9, 0.55), project('p2', 0.85, 0.6)]);
    expect(result).toEqual({ thresholdAutoPublish: null, thresholdNeedsReview: null });
  });

  it('un proyecto inactivo con otros umbrales no impide el valor comun de los activos', () => {
    const result = agreedThresholds([project('p1', 0.9, 0.55, true), project('p2', 0.85, 0.6, false), project('p3', 0.9, 0.55, true)]);
    expect(result).toEqual({ thresholdAutoPublish: 0.9, thresholdNeedsReview: 0.55 });
  });

  it('si los activos difieren entre si siguen en null, aunque el inactivo coincida con uno', () => {
    const result = agreedThresholds([project('p1', 0.9, 0.55, true), project('p2', 0.85, 0.55, true), project('p3', 0.9, 0.55, false)]);
    expect(result).toEqual({ thresholdAutoPublish: null, thresholdNeedsReview: 0.55 });
  });

  it('un solo activo entre varios inactivos: ese es el valor', () => {
    const result = agreedThresholds([project('p1', 0.7, 0.4, false), project('p2', 0.9, 0.55, true), project('p3', 0.8, 0.5, false)]);
    expect(result).toEqual({ thresholdAutoPublish: 0.9, thresholdNeedsReview: 0.55 });
  });

  it('sin ningun activo usa todos como respaldo: coinciden, hay valor', () => {
    const result = agreedThresholds([project('p1', 0.9, 0.55, false), project('p2', 0.9, 0.55, false)]);
    expect(result).toEqual({ thresholdAutoPublish: 0.9, thresholdNeedsReview: 0.55 });
  });

  it('sin ningun activo y con valores distintos, el respaldo da null', () => {
    const result = agreedThresholds([project('p1', 0.9, 0.55, false), project('p2', 0.85, 0.6, false)]);
    expect(result).toEqual({ thresholdAutoPublish: null, thresholdNeedsReview: null });
  });

  it('un proyecto sin la marca cuenta como activo', () => {
    const result = agreedThresholds([project('p1', 0.9, 0.55), project('p2', 0.85, 0.6, false)]);
    expect(result).toEqual({ thresholdAutoPublish: 0.9, thresholdNeedsReview: 0.55 });
  });
});
