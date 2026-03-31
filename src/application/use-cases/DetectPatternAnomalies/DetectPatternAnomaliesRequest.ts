export interface DetectPatternAnomaliesRequest {
  patientId: string;
  minimumOccurrences?: number;
  timeWindowMonths?: number;
}
