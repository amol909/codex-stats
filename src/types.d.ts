declare module "cli-graph" {
  export default class CliGraph {
    constructor(options?: {
      height?: number;
      width?: number;
      aRatio?: number;
      center?: { x?: number; y?: number };
      marks?: Partial<{
        hAxis: string;
        vAxis: string;
        center: string;
        point: string;
        rightArrow: string;
        topArrow: string;
        background: string;
      }>;
    });

    addPoint(x: number, y: number, chr?: string): this;
    toString(): string;
  }
}
