class Building {
   constructor(poly, height = null, roofColor = null, wallColor = null) {
      this.base = poly;
      this.height = height ?? Math.floor(55 + Math.random() * 75);

      const roofPalette = ["#C85A48", "#B54A3F", "#9E473B", "#5A626A", "#7A5C4D"];
      const wallPalette = ["#F7F5F0", "#EFECE6", "#E8E2D5", "#F2EFE9"];

      this.roofColor = roofColor ?? roofPalette[Math.floor(Math.random() * roofPalette.length)];
      this.wallColor = wallColor ?? wallPalette[Math.floor(Math.random() * wallPalette.length)];
      this.flatRoof = this.base.points.length != 4 || this.height > 105;
   }

   static load(info) {
      return new Building(
         Polygon.load(info.base),
         info.height,
         info.roofColor,
         info.wallColor
      );
   }

   draw(ctx, viewPoint) {
      const topPoints = this.base.points.map((p) =>
         getFake3dPoint(p, viewPoint, this.height * 0.6)
      );
      const ceiling = new Polygon(topPoints);

      const sides = [];
      for (let i = 0; i < this.base.points.length; i++) {
         const nextI = (i + 1) % this.base.points.length;
         const poly = new Polygon([
            this.base.points[i], this.base.points[nextI],
            topPoints[nextI], topPoints[i]
         ]);
         sides.push(poly);
      }
      sides.sort(
         (a, b) =>
            b.distanceToPoint(viewPoint) -
            a.distanceToPoint(viewPoint)
      );

      this.base.draw(ctx, { fill: this.wallColor, stroke: "rgba(0,0,0,0.2)", lineWidth: 20 });
      for (const side of sides) {
         side.draw(ctx, { fill: this.wallColor, stroke: "#AAA" });
      }

      if (this.flatRoof) {
         ceiling.draw(ctx, { fill: this.roofColor, stroke: "#555", lineWidth: 4 });
         return;
      }

      const baseMidpoints = [
         average(this.base.points[0], this.base.points[1]),
         average(this.base.points[2], this.base.points[3])
      ];

      const topMidpoints = baseMidpoints.map((p) =>
         getFake3dPoint(p, viewPoint, this.height)
      );

      const roofPolys = [
         new Polygon([
            ceiling.points[0], ceiling.points[3],
            topMidpoints[1], topMidpoints[0]
         ]),
         new Polygon([
            ceiling.points[2], ceiling.points[1],
            topMidpoints[0], topMidpoints[1]
         ])
      ];
      roofPolys.sort(
         (a, b) =>
            b.distanceToPoint(viewPoint) -
            a.distanceToPoint(viewPoint)
      );

      ceiling.draw(ctx, { fill: this.wallColor, stroke: this.wallColor, lineWidth: 6 });
      for (const poly of roofPolys) {
         poly.draw(ctx, { fill: this.roofColor, stroke: this.roofColor, lineWidth: 8, join: "round" });
      }
   }
}