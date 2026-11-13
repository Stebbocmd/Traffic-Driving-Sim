const Osm = {
    parseRoads: (data) => {
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
        const segments = [];
        for (const node of nodes) {
            const y = invLerp(maxLat, minLat, node.lat) * height;
            const x = invLerp(minLon, maxLon, node.lon) * width;
            const point = new Point(x, y);
            point.id = node.id;
            points.push(point);
        }

                const ways = data.elements.filter((w) => w.type == "way");

        // Contiamo in quante strade compare ogni nodo (se > 1 è un incrocio vero!)
        const nodeCounts = {};
        for (const way of ways) {
            for (const id of way.nodes) {
                nodeCounts[id] = (nodeCounts[id] || 0) + 1;
            }
        }

        for (const way of ways) {
            const ids = way.nodes;
            let prev = points.find((p) => p.id == ids[0]);
            for (let i = 1; i < ids.length; i++) {
                const cur = points.find((p) => p.id == ids[i]);
                const isLast = i == ids.length - 1;
                const isIntersection = nodeCounts[cur.id] > 1;

                if (isLast || isIntersection || distance(prev, cur) >= 80) {
                    const oneWay = way.tags.oneway || way.tags.lanes == 1;
                    segments.push(new Segment(prev, cur, oneWay));
                    prev = cur;
                }
            }
        }

        // Teniamo solo i punti effettivamente usati dai segmenti
        const usedPoints = points.filter((p) => segments.some((s) => s.includes(p)));

        return { points: usedPoints, segments, width, height };
    }
};