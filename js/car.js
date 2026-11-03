class Car{
    constructor(center,directionVector,width,height){
        this.center = center;
        this.directionVector = directionVector;
        // Width & Height for Hitbox
        this.width= width;  
        this.height = height;
        this.#updateHitbox();
        this.speed = 3;

        this.rayCount = 5;
        this.rayLength = 150;
        this.raySpread = Math.PI / 4;
        this.rays = [];
        this.#updateRays();
        this.readings = [];

        this.img = new Image();
        this.img.src = "car.png"
        this.type = "car";
    }

    #getReading(ray,roadBorders,markings){
        const touches = [];
        for (const border of roadBorders){
            const touch = getIntersection(ray.p1,ray.p2,border.p1,border.p2);
            if(touch){
                touches.push(touch)
            }
        }
        for (const marking of markings){
            if(marking.border){
                const touch = getIntersection(ray.p1,ray.p2,marking.border.p1,marking.border.p2);
                if(touch){
                    touch.marking = marking;
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

    updateCar(laneGuides,roadBorders,markings){
        this.readings = [];
        this.center = translate(this.center,angle(this.directionVector),-this.speed);
        const seg = getNearestSegment(this.center,laneGuides);
        if(seg){
            const proj = seg.projectPoint(this.center);
        if (proj.offset >= 0 && proj.offset <= 1){
            this.center = proj.point;
            this.directionVector = seg.directionVector();
        }}

        for (const ray of this.rays){
            this.readings.push(this.#getReading(ray,roadBorders,markings));
        }

    this.#updateHitbox();
    this.#updateRays();
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