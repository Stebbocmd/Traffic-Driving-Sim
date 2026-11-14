// Made by Stefano Tisi //
// Concept based on Js Graphs: function G =(V,E) in which V is Vertices and E is Edges. Can be bidirectional or unidirectional.//
// In our case, every node will be an intersection //

class Graph {
    constructor(points= [], segments = [])  {
        this.points = points;
        this.segments = segments;
    }

    static load(info){
        const points = info.points.map((i) => new Point(i.x,i.y));
        const segments = info.segments.map((i) => new Segment(
                points.find((p) => p.equals(i.p1)),
                points.find((p) => p.equals(i.p2)),));
        return new Graph(points,segments);
    }

    hash(){
        return JSON.stringify(this);
    }

    addPoint(point) {   // Adds point to the map
        this.points.push(point);
    }

    containsPoint(point){    // Check if a point already exist in a same location
        return this.points.find((p) => p.equals(point));
    }

    tryAddPoint(point){
        if(!this.containsPoint(point)) {
            this.addPoint(point);
            return true;
        }
        return false;
    }

    addSegment(seg){
        this.segments.push(seg);
    }

    containsSegment(seg){
        return this.segments.find((s) => s.equals(seg));
    }
    tryAddSegment(seg){
        if(!this.containsSegment(seg) && !seg.p1.equals(seg.p2)){
            this.addSegment(seg);
            return true;
        }
        return false;
    }

    removeSegment(seg) {
        this.segments.splice(this.segments.indexOf(seg), 1);  // Splice removes elements at the given index , 1 of them
    }

    getSegmentsWithPoint(point){
        const segs = [];
        for (const seg of this.segments){
            if (seg.includes(point)) {
                segs.push(seg);
            }
        }
        return segs;
    }

    getShortestPath(start, end, prevPoint = null,nextEndPoint = null) {
        for (const point of this.points){
            point.dist = Number.MAX_SAFE_INTEGER;
            point.visited = false;
            point.prev = null;
        }

        let currentPoint = start;
        currentPoint.dist = 0;

        while (!end.visited) {
            const segs = this.getSegmentsWithPoint(currentPoint);
            const fromPoint = currentPoint.equals(start) ? prevPoint : currentPoint.prev;
            for (const seg of segs) {
                const otherPoint = seg.p1.equals(currentPoint) ? seg.p2 : seg.p1;
                if (fromPoint) {
                    const inDir = normalize(subtract(currentPoint, fromPoint));
                    const outDir = normalize(subtract(otherPoint, currentPoint));
                    if (dot(inDir, outDir) < -0.7) {
                        continue; // Impedisce inversioni a U e svolte illegali a V (> 135°)
                    }
                }
                if (nextEndPoint && currentPoint.equals(nextEndPoint) && otherPoint.equals(end)) {
                    continue; // Impedisce di entrare nel segmento Target contromano
                }
                if (otherPoint.visited) {
                    continue;
                }
                if (currentPoint.dist + seg.length() < otherPoint.dist) {
                    otherPoint.dist = currentPoint.dist + seg.length();
                    otherPoint.prev = currentPoint;
                }
            }
            currentPoint.visited = true;

            const unvisited = this.points.filter((p)=> p.visited == false);
            const dists = unvisited.map((p) => p.dist);
            const minDist = Math.min(...dists);
            currentPoint = unvisited.find((p) => p.dist == minDist);
            if(!currentPoint || currentPoint.dist == Number.MAX_SAFE_INTEGER){
                break; // Non reachable Target 
            }
        }

        const path = [];
        let current = end;
        while(current){
            path.push(current);
            current = current.prev;
        }

        for (const point of this.points){
            delete point.dist;
            delete point.visited;
            delete point.prev;
        }

        return path.reverse();
    }

    removePoint(point) {
        const segs = this.getSegmentsWithPoint(point);
        for (const seg of segs){
            this.removeSegment(seg);
        }
        this.points.splice(this.points.indexOf(point), 1);
    }

    dispose(){
        this.points.length = 0;
        this.segments.length = 0;
    }

    draw(ctx) {
        for (const seg of this.segments) {
            seg.draw(ctx);
        }

        for (const point of this.points) {
        point.draw(ctx);
    }
    }

    
}
