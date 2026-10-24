import { ProjectThresholdsItem } from '../../api/models/project-thresholds-item';
import { agreedThresholds } from './confidence-thresholds';

function project(id: string, autoPublish: number, needsReview: number): ProjectThresholdsItem {
  return {
    project_id: id,
    threshold_auto_publish: autoPublish,
    threshold_needs_review: needsReview,
    similarity_threshold: 0.4,
    first_response_target_seconds: 30,
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
});
