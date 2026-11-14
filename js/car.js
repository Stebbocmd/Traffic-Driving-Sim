class Car{
    constructor(center,directionVector,width,height){
        this.center = center;
        this.directionVector = directionVector;
        // Width & Height for Hitbox
        this.width= width;  
        this.height = height;
        this.#updateHitbox();
        this.speed = 20;
        this.maxSpeed = 20;

        this.rayCount = 5;
        this.rayLength = 150;
        this.raySpread = Math.PI / 4;
        this.rays = [];
        this.#updateRays();
        this.readings = [];

        this.img = new Image();
        this.img.src = "car.png"
        this.type = "car";

        this.stopTimer = 0;
        this.lastStop = null;
    }

    #getReading(ray, roadBorders, markings, cars) {
        const touches = [];
        for (const border of roadBorders) {
            const touch = getIntersection(ray.p1, ray.p2, border.p1, border.p2);
            if (touch) {
                touches.push(touch);
            }
        }
        for (const marking of markings) {
            if (marking.border) {
                const touch = getIntersection(ray.p1, ray.p2, marking.border.p1, marking.border.p2);
                if (touch) {
                    touch.marking = marking;
                    touches.push(touch);
                }
            } else if (marking.borders) {
                for (const border of marking.borders) {
                    const touch = getIntersection(ray.p1, ray.p2, border.p1, border.p2);
                    if (touch) {
                        touch.marking = marking;
                        touches.push(touch);
                    }
                }
            }
        }
        for (const car of cars) {
            if (car == this) continue; // Ignora se stessa!
            for (const seg of car.poly.segments) {
                const touch = getIntersection(ray.p1, ray.p2, seg.p1, seg.p2);
                if (touch) {
                    touch.car = car;
                    touches.push(touch);
                }
            }
        }
        let minOffset = Number.MAX_SAFE_INTEGER;
        let nearest = null;
        for (const touch of touches) {
            if (touch.offset < minOffset) {
                minOffset = touch.offset;
                nearest = touch;
            }
        }
        return nearest;
    }

    #updateRays(){
        this.rays = [];
        for (let i = 0; i < this.rayCount; i++){
            const rayAngle = angle(this.directionVector) + lerp(this.raySpread / 2, -this.raySpread / 2,
                this.rayCount == 1 ? 0.5 : i / (this.rayCount-1)
            )
            this.rays.push(new Segment(this.center,translate(this.center,rayAngle,-this.rayLength)));
        }
    }

    #updateHitbox(){
        this.support = new Segment(
            translate(this.center,angle(this.directionVector), this.height / 2),
            translate(this.center,angle(this.directionVector), -this.height / 2)
        );
        this.poly = new Envelope(this.support,this.width,0).poly;
    }

    #checkMarkings() {
        this.speed = this.maxSpeed;
        if(this.target && distance(this.center,this.target.center) < 80 ){
            this.speed = 0;
            this.state = "stop";
            return;
        }
        for (const reading of this.readings) {
            if (!reading) continue;

            if (reading.car && reading.offset < 0.5 && dot(reading.car.directionVector,this.directionVector) > -0.5) {
                this.speed = 0;
                break;
            }

            if (!reading.marking) continue;

            if (reading.marking.type == "light") {
                if (dot(reading.marking.directionVector, this.directionVector) > 0.7 && reading.offset < 0.5) {
                    if (reading.marking.state == "red" || reading.marking.state == "yellow") {
                        this.speed = 0;
                        break;
                    }
                }
            } else if (reading.marking.type == "stop") {
                if (dot(reading.marking.directionVector, this.directionVector) > 0.7 &&
                    reading.offset < 0.5 &&
                    reading.marking != this.lastStop) {
                    this.speed = 0;
                    this.stopTimer++;
                    if (this.stopTimer > 120) {
                        this.lastStop = reading.marking;
                        this.stopTimer = 0;
                        this.speed = this.maxSpeed;
                    }
                    break;
                }
            } else if (reading.marking.type == "parking") {
                if (reading.offset < 0.2) {
                    this.speed = 0;
                    break;
                }
            }
        }
    }

            updateCar(laneGuides, roadBorders, markings, cars) {
        this.readings = [];
        const steps = Math.max(1, Math.ceil(this.speed / 3));
        const stepSpeed = this.speed / steps;

        for (let i = 0; i < steps; i++) {
            this.center = translate(this.center, angle(this.directionVector), -stepSpeed);
            const validGuides = laneGuides.filter(
                (s) => dot(s.directionVector(), this.directionVector) > -0.1 &&
                    s.projectPoint(this.center).offset >= 0
            );
            const seg = getNearestSegment(this.center, validGuides);
            if (seg) {
                const proj = seg.projectPoint(this.center);
                this.directionVector = seg.directionVector();
                if (proj.offset <= 1) {
                    this.center = proj.point;
                } else {
                    this.center = seg.p2;
                }
            }
        }

        this.#updateHitbox();
        this.#updateRays();
        for (const ray of this.rays) {
            this.readings.push(this.#getReading(ray, roadBorders, markings, cars));
        }
        this.#checkMarkings();
    }

    draw(ctx){
        ctx.save();
        ctx.translate(this.center.x,this.center.y);
        ctx.rotate(angle(this.directionVector) - Math.PI / 2);
        ctx.drawImage(this.img, -this.img.width / 2, -this.img.height / 2, this.img.width, this.img.height);
        ctx.restore();
        this.poly.draw(ctx);
        for (const ray of this.rays){ // Debug
            ray.draw(ctx, {color: "yellow",width: 2});
        }
        for (const reading of this.readings){ // Debug
            if(reading){
                new Point(reading.x,reading.y).draw(ctx);
            }
        }
    }
}