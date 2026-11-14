class Polygon {
    constructor(points){
        this.points = points;
        this.segments = [];
        for (let i = 1; i <= points.length ; i++){
            this.segments.push(
                new Segment(points[i-1],points[i % points.length])
            );
        }
    }

    static load(info){
        return new Polygon(
            info.points.map((i) => new Point(i.x, i.y))
        );
    }

    getBounds() {
        if (!this._bounds) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const p of this.points) {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            }
            this._bounds = { minX, maxX, minY, maxY };
        }
        return this._bounds;
    }

    static boundsOverlap(b1, b2, pad = 0) {
        return !(
            b1.maxX + pad < b2.minX ||
            b2.maxX + pad < b1.minX ||
            b1.maxY + pad < b2.minY ||
            b2.maxY + pad < b1.minY
        );
    }

    static union(polys) {
        Polygon.multiBreak(polys);
        const keptSegments = [];
        for (let i = 0; i < polys.length; i++) {
            const b1 = polys[i].getBounds();
            // Filtriamo subito solo i poligoni il cui rettangolo si sovrappone a polys[i]
            const neighbors = [];
            for (let j = 0; j < polys.length; j++) {
                if (i != j && Polygon.boundsOverlap(b1, polys[j].getBounds())) {
                    neighbors.push(polys[j]);
                }
            }
            for (const seg of polys[i].segments) {
                let keep = true;
                for (const neighbor of neighbors) {
                    if (neighbor.containsSegment(seg)) {
                        keep = false;
                        break;
                    }
                }
                if (keep) {
                    keptSegments.push(seg);
                }
            }
        }
        return keptSegments;
    }

    distanceToPoint(point) {
        const b = this.getBounds();
        const dx = Math.max(b.minX - point.x, 0, point.x - b.maxX);
        const dy = Math.max(b.minY - point.y, 0, point.y - b.maxY);
        // Se il punto è già molto lontano dal rettangolo del poligono, evitiamo il ciclo sui segmenti
        if (dx > 350 || dy > 350) return Math.hypot(dx, dy);
        return Math.min(...this.segments.map((s) => s.distanceToPoint(point)));
    }

    distanceToPoly(poly) {
        if (!Polygon.boundsOverlap(this.getBounds(), poly.getBounds(), 100)) {
            return Infinity;
        }
        return Math.min(...this.points.map((p) => poly.distanceToPoint(p)));
    }

    intersectsPoly(poly) {
        if (!Polygon.boundsOverlap(this.getBounds(), poly.getBounds())) {
            return false;
        }
        for (let s1 of this.segments) {
            for (let s2 of poly.segments) {
                if (getIntersection(s1.p1, s1.p2, s2.p1, s2.p2)) {
                    return true;
                }
            }
        }
        return false;
    }

    containsSegment(seg) {
        const midpoint = average(seg.p1, seg.p2);
        return this.containsPoint(midpoint);
    }

    containsPoint(point) {
        const b = this.getBounds();
        if (point.x < b.minX || point.x > b.maxX || point.y < b.minY || point.y > b.maxY) {
            return false;
        }
        const outerPoint = new Point(-100000, -100000);
        let intersectionCount = 0;
        for (const seg of this.segments) {
            const int = getIntersection(outerPoint, point, seg.p1, seg.p2);
            if (int) {
                intersectionCount++;
            }
        }
        return intersectionCount % 2 == 1;
    }

    static multiBreak(polys) {
        for (const p of polys) p.getBounds();
        for (let i = 0; i < polys.length - 1; i++) {
            const b1 = polys[i].getBounds();
            for (let j = i + 1; j < polys.length; j++) {
                if (Polygon.boundsOverlap(b1, polys[j].getBounds())) {
                    Polygon.break(polys[i], polys[j]);
                }
            }
        }
    }

    static break(poly1,poly2){
        const segs1 = poly1.segments;
        const segs2 = poly2.segments;
        for(let i = 0 ; i < segs1.length;i++){
            for (let j = 0; j < segs2.length;j++){
                const int = getIntersection(
                    segs1[i].p1 , segs1[i].p2,segs2[j].p1,segs2[j].p2
                );

                if (int && int.offset != 1 && int.offset != 0){
                    const point = new Point(int.x,int.y);
                    let aux = segs1[i].p2;
                    segs1[i].p2 = point;
                    segs1.splice(i+1,0,new Segment(point,aux));
                    aux = segs2[j].p2;
                    segs2[j].p2 = point;
                    segs2.splice(j+1,0,new Segment(point,aux));
                }
            }
        }
    }

    drawSegments(ctx){
        for (const seg of this.segments) {
            seg.draw(ctx, {color: getRandomColor(), width: 5});
        }
    }

    draw(ctx, {stroke = "blue" , lineWidth = 2 , fill = "rgba(0,0,255,0.3)"} = {}){
        ctx.beginPath();
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.moveTo(this.points[0].x,this.points[0].y);
        for (let i =1 ; i < this.points.length; i++){
            ctx.lineTo(this.points[i].x , this.points[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}