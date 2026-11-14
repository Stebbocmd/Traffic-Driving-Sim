const Osm = {
    parseRoads: (data,roadWidth = 100) => {
        const nodes = data.elements.filter((n) => n.type == "node");

        const lats = nodes.map((n) => n.lat);
        const lons = nodes.map((n) => n.lon);

        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);

        const deltaLat = maxLat - minLat;
        const deltaLon = maxLon - minLon;
        const ar = deltaLon / deltaLat;
        const height = deltaLat * 111000 * 10;
        const width = height * ar * Math.cos(degToRad(maxLat));

                const points = [];
        const pointById = new Map();
        const segments = [];
        for (const node of nodes) {
            const y = invLerp(maxLat, minLat, node.lat) * height;
            const x = invLerp(minLon, maxLon, node.lon) * width;
            const point = new Point(x, y);
            point.id = node.id;
            point.tags = node.tags;
            points.push(point);
            pointById.set(node.id, point);
        }

        const ways = data.elements.filter((w) => w.type == "way" && w.tags && w.tags.highway);

        const nodeCounts = {};
        for (const way of ways) {
            for (const id of way.nodes) {
                nodeCounts[id] = (nodeCounts[id] || 0) + 1;
            }
        }

        const usedSet = new Set();
        for (const way of ways) {
            const ids = way.nodes;
            let prev = pointById.get(ids[0]);
            for (let i = 1; i < ids.length; i++) {
                const cur = pointById.get(ids[i]);
                if (!prev || !cur) continue;
                const isLast = i == ids.length - 1;
                const isIntersection = nodeCounts[cur.id] > 1;

                if (isLast || isIntersection || distance(prev, cur) >= 80) {
                    const oneWay = way.tags.oneway || way.tags.lanes == 1;
                    segments.push(new Segment(prev, cur, oneWay));
                    usedSet.add(prev);
                    usedSet.add(cur);
                    prev = cur;
                }
            }
        }

        const usedPoints = Array.from(usedSet);
        const markings = [];
        for(const point of points){
            if(!point.tags || !point.tags.highway) continue;
            const type = point.tags.highway;
            if(!["crossing","stop","give_way","traffic_signals"].includes(type))
                continue;
            const seg = getNearestSegment(point,segments,roadWidth);
            if(!seg) continue;

            const proj = seg.projectPoint(point);
            const offset = Math.max(0.2,Math.min(0.8,proj.offset));
            const posOnSeg = lerp2D(seg.p1,seg.p2,offset);

            if(type=="crossing"){
                markings.push(new Crossing(posOnSeg,seg.directionVector(),roadWidth,roadWidth / 2));
            } else{
                const intPoint = distance(point,seg.p1) < distance(point,seg.p2) ? seg.p1 : seg.p2;
                const otherPoint = intPoint.equals(seg.p1) ? seg.p2 :seg.p1;
                const dir = normalize(subtract(otherPoint,intPoint));
                const laneCenter = add(posOnSeg, scale(perpendicular(dir),-roadWidth / 4));

                if(type == "stop"){
                    markings.push(new Stop(laneCenter,dir,roadWidth /2,roadWidth /2));
                }   else if(type == "give_way"){
                    markings.push(new Yield(laneCenter,dir,roadWidth /2,roadWidth /2));
                }   else if(type == "traffic_signals"){
                    markings.push(new Light(laneCenter,dir,roadWidth /2,roadWidth /2));
                }
                
            }
        }

        const buildings = [];
        const buildingWays = data.elements.filter((w) => w.type == "way" && w.tags && w.tags.building);
            for (const way of buildingWays) {
         // In OSM l'ultimo nodo di un edificio ripete il primo per chiudere il poligono
                const bPoints = way.nodes
                .slice(0, -1)
                .map((id) => pointById.get(id))
                .filter(Boolean);
                if (bPoints.length >= 3) {
                    const levels = parseInt(way.tags["building:levels"]);
                    const bHeight = levels ? Math.min(200, 35 + levels * 25) : null;
                    buildings.push(new Building(new Polygon(bPoints), bHeight));
                }
            } 
        return { points: usedPoints, segments, markings, buildings, width, height };
    }
};