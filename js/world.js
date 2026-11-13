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
        this.buildings = this.#generateBuildings();
        this.trees = this.#generateTrees();

        this.laneGuides.length = 0;
        this.laneGuides.push(...this.#generateLaneGuides());
    }

        generateCars() {
        const startMarkings = this.markings.filter((m) => m instanceof Start);
        const target = this.markings.find((m) => m instanceof Target);
        this.cars.length = 0;
        for (const marking of startMarkings) {
            const car = new Car(marking.center, marking.directionVector, 30, 50);
            car.target = target;
            if (target) {
                const startCenter = add(marking.center, scale(perpendicular(marking.directionVector), this.roadWidth / 4));
                const endCenter = add(target.center, scale(perpendicular(target.directionVector), this.roadWidth / 4));
                const startSeg = getNearestSegment(startCenter, this.graph.segments);
                const endSeg = getNearestSegment(endCenter, this.graph.segments);

                const startPoint = dot(subtract(startSeg.p1, startSeg.p2), marking.directionVector) < 0 ? startSeg.p1 : startSeg.p2;
                const prevPoint = startPoint.equals(startSeg.p1) ? startSeg.p2 : startSeg.p1;
                const endPoint = dot(subtract(endSeg.p1, endSeg.p2), target.directionVector) > 0 ? endSeg.p1 : endSeg.p2;
                const nextEndPoint = endPoint.equals(endSeg.p1) ? endSeg.p2 : endSeg.p1;

                let path = this.graph.getShortestPath(startPoint, endPoint, prevPoint, nextEndPoint);
                if (path.length <= 1 && !startPoint.equals(endPoint)) {
                    path = this.graph.getShortestPath(startPoint, endPoint, prevPoint);
                }

                const pathSegments = [startSeg];
                for (let i = 0; i < path.length - 1; i++) {
                    pathSegments.push(new Segment(path[i], path[i + 1]));
                }
                if (!pathSegments.some((s) => s.equals(endSeg))) {
                    pathSegments.push(endSeg);
                }
                car.laneGuides = this.#generateLaneGuides(pathSegments);
            }
            this.cars.push(car);
        }
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

    #generateBuildings(){
        const tmpEnvelopes = [];
        for (const seg of this.graph.segments){
            tmpEnvelopes.push(
                new Envelope(
                    seg,
                    this.roadWidth + this.buildingWidth + this.spacing * 2,
                    this.roadRoundness
                )
            );
        }

        const guides = Polygon.union(tmpEnvelopes.map((e) => e.poly));

        for (let i = 0; i < guides.length; i ++){
            const seg = guides[i];
            if(seg.length() < this.buildingMinLength){
                guides.splice(i,1);
                i--; // So that it doesn't skip, because every item in the array will be shifted if something is removed
            }
        }

        const supports = [];
        for (let seg of guides){
            const len = seg.length() + this.spacing;
            const buildingCount = Math.floor(
                len / (this.buildingMinLength + this.spacing)
            );
            const buildingLength = len / buildingCount - this.spacing;

            const dir = seg.directionVector();

            let q1 = seg.p1;
            let q2 = add(q1,scale(dir, buildingLength));
            supports.push(new Segment(q1,q2));

            for(let i = 2 ; i<= buildingCount; i++){
                q1 = add(q2,scale(dir,this.spacing));
                q2 = add(q1,scale(dir,buildingLength));
                supports.push(new Segment(q1,q2));
            }
        }

        const bases = [];
        for (const seg of supports){
            bases.push(new Envelope(seg, this.buildingWidth).poly);

        }

        const eps = 0.001;
        for (let i = 0; i < bases.length - 1; i++){
            for(let j = i + 1; j < bases.length; j++){
                if (bases[i].intersectsPoly(bases[j]) || 
                    bases[i].distanceToPoly(bases[j]) < this.spacing - eps
                ){
                    bases.splice(j,1);
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

        for (const car of this.cars){
            car.draw(ctx);
            car.updateCar(car.laneGuides || this.laneGuides,this.roadBorders,this.markings,this.cars);
        }

            const items = [...this.buildings, ...this.trees].filter(
                (i) => i.base.distanceToPoint(viewPoint) < 1200 * zoom
            );
            items.sort(
                (a, b) =>
                b.base.distanceToPoint(viewPoint) -
                a.base.distanceToPoint(viewPoint)
            );
        for (const item of items) {
            item.draw(ctx, viewPoint);
        }
    }
}