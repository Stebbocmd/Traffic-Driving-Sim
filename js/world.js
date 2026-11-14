class World {
    constructor(graph,
        roadWidth = 100, 
        roadRoundness = 10,
        buildingWidth = 150,
        buildingMinLength = 150,
        spacing = 50,
        treeSize = 160
    ){
        this.graph = graph;
        this.roadWidth = roadWidth;
        this.roadRoundness = roadRoundness;
        this.buildingWidth= buildingWidth;
        this.buildingMinLength = buildingMinLength;
        this.spacing = spacing;
        this.treeSize = treeSize;

        this.envelopes = [];
        this.roadBorders = [];
        this.buildings = [];
        this.trees = [];
        this.laneGuides = [];

        this.markings = [];

        this.cars = [];
        this.frameCount = 0;

        this.generate();
    }

    static load(info){
        const world = new World(new Graph());
        world.graph = Graph.load(info.graph);
        world.roadWidth = info.roadWidth;
        world.roadRoundness = info.roadRoundness;
        world.buildingWidth= info.buildingWidth;
        world.buildingMinLength = info.buildingMinLength;
        world.spacing = info.spacing;
        world.treeSize = info.treeSize;
        world.envelopes = info.envelopes.map((e) => Envelope.load(e));
        world.roadBorders = info.roadBorders.map((b) => new Segment(b.p1, b.p2));
        world.buildings = info.buildings.map((e) => Building.load(e));
        world.trees = info.trees.map((t) => new Tree(t.center, info.treeSize));
        world.laneGuides = info.laneGuides.map((l) => new Segment(l.p1,l.p2))
        world.markings = info.markings.map((m) => Marking.load(m));
        world.zoom = info.zoom;
        world.offset = info.offset;
        return world;
    }

    generate() {
        this.envelopes.length = 0;
        for (const seg of this.graph.segments) {
            this.envelopes.push(
                new Envelope(seg,this.roadWidth,this.roadRoundness)
            );
        }
        this.roadBorders = Polygon.union(this.envelopes.map((e) => e.poly));
        if(this.osmBuildings && this.osmBuildings.length > 0){
            this.buildings = this.osmBuildings.filter(
                (b) => !this.envelopes.some((e) => b.base.intersectsPoly(e.poly))
            );
        } else {
            this.buildings = this.#generateBuildings(); // If there aren't osm Buildings
        }
        this.trees = this.#generateTrees();

        this.laneGuides.length = 0;
        this.laneGuides.push(...this.#generateLaneGuides());
    }

    generateCars(carCount = 40) {
        const startMarkings = this.markings.filter((m) => m instanceof Start);
        const manualTarget = this.markings.find((m) => m instanceof Target);
        this.cars.length = 0;

        // 1) Se ci sono Start piazzati a mano, usiamo quelli
        for (const marking of startMarkings) {
            const car = new Car(marking.center, marking.directionVector, 30, 50);
            this.assignRandomTarget(car, manualTarget);
            this.cars.push(car);
        }

        // 2) Se non ci sono Start manuali, generiamo le auto in modo aleatorio sulla mappa
        if (startMarkings.length == 0 && this.graph.segments.length > 0) {
            const validSegs = this.graph.segments.filter((s) => s.length() >= 90);
            let tries = 0;
            while (this.cars.length < carCount && tries < carCount * 10) {
                tries++;
                const seg = validSegs[Math.floor(Math.random() * validSegs.length)];
                if (!seg) break;

                let dir = seg.directionVector();
                if (!seg.oneWay && Math.random() < 0.5) {
                    dir = scale(dir, -1);
                }
                const mid = lerp2D(seg.p1, seg.p2, 0.3 + Math.random() * 0.4);
                const laneCenter = add(mid, scale(perpendicular(dir), -this.roadWidth / 4));

                // Evitiamo di far nascere due auto una sopra l'altra
                if (this.cars.some((c) => distance(c.center, laneCenter) < 140)) {
                    continue;
                }

                const car = new Car(laneCenter, dir, 30, 50);
                if (this.assignRandomTarget(car, manualTarget)) {
                    this.cars.push(car);
                }
            }
        }
    }

    assignRandomTarget(car, manualTarget = null) {
        const startCenter = add(car.center, scale(perpendicular(car.directionVector), this.roadWidth / 4));
        const startSeg = getNearestSegment(startCenter, this.graph.segments);
        if (!startSeg) return false;

        const startPoint = dot(subtract(startSeg.p1, startSeg.p2), car.directionVector) < 0 ? startSeg.p1 : startSeg.p2;
        const prevPoint = startPoint.equals(startSeg.p1) ? startSeg.p2 : startSeg.p1;

        for (let tries = 0; tries < 15; tries++) {
            let endSeg, endDir, targetObj;

            if (manualTarget) {
                const endCenter = add(manualTarget.center, scale(perpendicular(manualTarget.directionVector), this.roadWidth / 4));
                endSeg = getNearestSegment(endCenter, this.graph.segments);
                endDir = manualTarget.directionVector;
                targetObj = manualTarget;
            } else {
                const candidates = this.graph.segments.filter(
                    (s) => s.length() >= 80 && !s.equals(startSeg) && distance(average(s.p1, s.p2), car.center) > 300
                );
                if (candidates.length == 0) break;
                endSeg = candidates[Math.floor(Math.random() * candidates.length)];
                endDir = endSeg.directionVector();
                if (!endSeg.oneWay && Math.random() < 0.5) {
                    endDir = scale(endDir, -1);
                }
                const endMid = average(endSeg.p1, endSeg.p2);
                const endLaneCenter = add(endMid, scale(perpendicular(endDir), -this.roadWidth / 4));
                targetObj = new Target(endLaneCenter, endDir, this.roadWidth / 2, this.roadWidth / 2);
            }

            const endPoint = dot(subtract(endSeg.p1, endSeg.p2), endDir) > 0 ? endSeg.p1 : endSeg.p2;
            const nextEndPoint = endPoint.equals(endSeg.p1) ? endSeg.p2 : endSeg.p1;

            let path = this.graph.getShortestPath(startPoint, endPoint, prevPoint, nextEndPoint);

            if (path.length > 1 || startPoint.equals(endPoint)) {
                const pathSegments = [startSeg];
                for (let i = 0; i < path.length - 1; i++) {
                    pathSegments.push(new Segment(path[i], path[i + 1]));
                }
                if (!pathSegments.some((s) => s.equals(endSeg))) {
                    pathSegments.push(endSeg);
                }
                car.target = targetObj;
                car.laneGuides = this.#generateLaneGuides(pathSegments);
                return true;
            }
            if (manualTarget) break;
        }
        return false;
    }

    #generateLaneGuides(segments = this.graph.segments){
        const tmpEnvelopes = [];
        for (const seg of segments){
            tmpEnvelopes.push(
                new Envelope(
                    seg,
                    this.roadWidth / 2,
                    this.roadRoundness
                )
            );
        }
        const unionSegments = Polygon.union(tmpEnvelopes.map((e) => e.poly));
        return unionSegments;
    }

    #generateTrees(){
        const points = [
            ...this.roadBorders.map((s) => [s.p1,s.p2]).flat(),
            ...this.buildings.map((b) => b.base.points).flat()
        ];
        const left = Math.min(...points.map((p) => p.x));
        const right = Math.max(...points.map((p) => p.x));
        const top = Math.min(...points.map((p) => p.y));
        const bottom = Math.max(...points.map((p) => p.y));

        const illegalPolys = [
            ...this.buildings.map((b) => b.base),
            ...this.envelopes.map((e) => e.poly)
        ];
        const trees = [];
        let tryCount = 0;
        while (tryCount < 100){
            const p = new Point(
                lerp(left,right,Math.random()),
                lerp(bottom,top,Math.random())
            );

            // check if tree inside or nearby the building / road //
            let keep = true;
            for (const poly of illegalPolys){
                if(poly.containsPoint(p) || poly.distanceToPoint(p) < this.treeSize /2){
                    keep = false;
                    break;
                }
            }
            // check if tree is too close to another //
            if(keep){
                for (const tree of trees){
                    if(distance(tree.center,p) < this.treeSize) {
                        keep = false;
                        break;
                    }
                }
            }
            // Avoiding trees in the middle of nowhere, for memory purposes //
            if(keep){
                let closeToSomething = false;
                for (const poly of illegalPolys){
                    if(poly.distanceToPoint(p) < this.treeSize * 2){
                        closeToSomething = true;
                        break;
                    }
                }
                keep = closeToSomething;
            }
            if(keep){
            trees.push(new Tree(p,this.treeSize));
            tryCount = 0;
            }
            tryCount++;
        }
        return trees;
    }

    #generateBuildings() {
        const tmpEnvelopes = [];
        for (const seg of this.graph.segments) {
            tmpEnvelopes.push(
                new Envelope(
                    seg,
                    this.roadWidth + this.buildingWidth + this.spacing * 2,
                    this.roadRoundness
                )
            );
        }

        const guides = Polygon.union(tmpEnvelopes.map((e) => e.poly));

        const bases = [];
        for (const seg of guides) {
            const totalLen = seg.length();
            if (totalLen < this.buildingMinLength) continue;

            const dir = seg.directionVector();
            let offset = 0;

            while (offset + this.buildingMinLength <= totalLen) {
                // 20% di probabilità di lasciare uno spazio aperto / giardino tra gli edifici
                if (Math.random() < 0.2) {
                    offset += this.spacing * 1.5;
                    continue;
                }

                // Lunghezza e larghezza variabili per evitare l'effetto "caserma"
                const randLen = this.buildingMinLength * (0.85 + Math.random() * 0.75);
                const buildingLength = Math.min(randLen, totalLen - offset);
                if (buildingLength < this.buildingMinLength * 0.8) break;

                const q1 = add(seg.p1, scale(dir, offset));
                const q2 = add(q1, scale(dir, buildingLength));
                const support = new Segment(q1, q2);

                const customWidth = this.buildingWidth * (0.75 + Math.random() * 0.3);
                bases.push(new Envelope(support, customWidth).poly);

                offset += buildingLength + this.spacing * (0.9 + Math.random() * 0.5);
            }
        }

        // 1) Rimuoviamo le case che invadono o sono troppo vicine a qualsiasi strada
        for (let i = 0; i < bases.length; i++) {
            for (const env of this.envelopes) {
                if (
                    bases[i].intersectsPoly(env.poly) ||
                    bases[i].distanceToPoly(env.poly) < this.spacing * 0.4
                ) {
                    bases.splice(i, 1);
                    i--;
                    break;
                }
            }
        }

        // 2) Rimuoviamo le case che si sovrappongono o sono troppo vicine tra loro
        const eps = 0.001;
        for (let i = 0; i < bases.length - 1; i++) {
            for (let j = i + 1; j < bases.length; j++) {
                if (
                    bases[i].intersectsPoly(bases[j]) ||
                    bases[i].distanceToPoly(bases[j]) < this.spacing - eps
                ) {
                    bases.splice(j, 1);
                    j--;
                }
            }
        }

        return bases.map((b) => new Building(b));
    }

    #updateLights(){
    const lights = this.markings.filter((m) => m instanceof Light);
    const controlCenters = [];
    for (const light of lights) {
        const point = getNearestPoint(light.center, this.graph.points);
        if (!point) continue;
            let controlCenter = controlCenters.find((p) => p.equals(point));
        if (!controlCenter) {
            controlCenter = new Point(point.x, point.y);
            controlCenter.lights = [light];
            controlCenters.push(controlCenter);
        } else {
        controlCenter.lights.push(light);
        }
    }
    const Tgreen = 4;
    const Tyellow = 2;
    const Tphase = Tgreen + Tyellow;
    const tick = Math.floor(this.frameCount / 60);

    for (const center of controlCenters){
        let isRoadA = false;
        const refDir = center.lights[0].directionVector;
        const delay = Math.floor(distance(center, controlCenters[0]) / 180);
        const cTick = (tick + delay) % (Tphase *2);
        const turnForRoadA = cTick < Tphase;
        const color = (cTick % Tphase) < Tgreen ? "green" : "yellow";
        for (const light of center.lights){
            if(Math.abs(dot(light.directionVector,refDir)) > 0.7){
                isRoadA = true;
            }
            else { isRoadA = false;}
            if (isRoadA == turnForRoadA) {
                light.state = color;
            }
            else {light.state = "red";}
        }
    }
    this.frameCount++;
    }

    draw(ctx,viewPoint,zoom = 1){
        this.#updateLights();
        for (const env of this.envelopes){
            env.draw(ctx, {fill: "#BBB",stroke: "#BBB",lineWidth: 15});
        }
        for (const marking of this.markings){
            if(this.cars.length == 0 || marking.type != "start"){
            marking.draw(ctx);}
        }
        for (const seg of this.graph.segments){
            seg.draw(ctx, {color:"white",width: 4 , dash: [10,10]})
        }
        for (const seg of this.roadBorders){
            seg.draw(ctx, {color: "white", width: 4});
        }
        
        const hasManualTarget = this.markings.some((m) => m instanceof Target);
        for (const car of this.cars) {
            car.draw(ctx);
            car.updateCar(car.laneGuides || this.laneGuides, this.roadBorders, this.markings, this.cars);
            if (car.state == "stop" && !hasManualTarget) {
                car.state = "moving";
                car.speed = car.maxSpeed;
                // Se da quel punto (es. vicolo cieco a senso unico) non c'è uscita, riposiziona l'auto
                if (!this.assignRandomTarget(car)) {
                    const validSegs = this.graph.segments.filter((s) => s.length() >= 90);
                    const seg = validSegs[Math.floor(Math.random() * validSegs.length)];
                    if (seg) {
                        car.directionVector = seg.directionVector();
                        const mid = average(seg.p1, seg.p2);
                        car.center = add(mid, scale(perpendicular(car.directionVector), -this.roadWidth / 4));
                        this.assignRandomTarget(car);
                    }
                }
            }
        }

        const maxViewDist = 1200 * zoom;
        const items = [];
        for (const item of [...this.buildings, ...this.trees]) {
            const d = item.base.distanceToPoint(viewPoint);
            if (d < maxViewDist) {
                item._dist = d;
                items.push(item);
            }
        }
        items.sort((a, b) => b._dist - a._dist);
        for (const item of items) {
            item.draw(ctx, viewPoint);
        }
        
    }
}