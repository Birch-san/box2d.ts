// DEBUG: import { b2Assert } from "../common/b2_common";
import { b2ShapeType } from "../collision/b2_shape";
import { b2Contact } from "./b2_contact";
import { b2CircleContact } from "./b2_circle_contact";
import { b2PolygonContact } from "./b2_polygon_contact";
import { b2PolygonAndCircleContact } from "./b2_polygon_circle_contact";
import { b2EdgeAndCircleContact } from "./b2_edge_circle_contact";
import { b2EdgeAndPolygonContact } from "./b2_edge_polygon_contact";
import { b2ChainAndCircleContact } from "./b2_chain_circle_contact";
import { b2ChainAndPolygonContact } from "./b2_chain_polygon_contact";
import { b2Fixture } from "./b2_fixture";

type CreateFcn = (fixtureA: b2Fixture, indexA: number, fixtureB: b2Fixture, indexB: number) => b2Contact;
type DestroyFcn = (contact: b2Contact) => void;

interface ContactConstructor {
    new (): b2Contact;
}

export type b2ContactRegister =
    | undefined
    | {
          createFcn: CreateFcn;
          destroyFcn: DestroyFcn;
      };

export class b2ContactFactory {
    public readonly m_registers: b2ContactRegister[][];

    constructor() {
        const result = new Array<b2ContactRegister[]>(b2ShapeType.e_typeCount);
        for (let i = 0; i < b2ShapeType.e_typeCount; i++)
            result[i] = new Array<b2ContactRegister>(b2ShapeType.e_typeCount);
        this.m_registers = result;

        this.AddType(b2CircleContact, b2ShapeType.e_circle, b2ShapeType.e_circle);
        this.AddType(b2PolygonAndCircleContact, b2ShapeType.e_polygon, b2ShapeType.e_circle);
        this.AddType(b2PolygonContact, b2ShapeType.e_polygon, b2ShapeType.e_polygon);
        this.AddType(b2EdgeAndCircleContact, b2ShapeType.e_edge, b2ShapeType.e_circle);
        this.AddType(b2EdgeAndPolygonContact, b2ShapeType.e_edge, b2ShapeType.e_polygon);
        this.AddType(b2ChainAndCircleContact, b2ShapeType.e_chain, b2ShapeType.e_circle);
        this.AddType(b2ChainAndPolygonContact, b2ShapeType.e_chain, b2ShapeType.e_polygon);
    }

    private AddType(Contact: ContactConstructor, typeA: b2ShapeType, typeB: b2ShapeType): void {
        const pool: b2Contact[] = [];
        const destroyFcn: DestroyFcn = (contact) => {
            pool.push(contact);
        };

        this.m_registers[typeA][typeB] = {
            createFcn(fixtureA, indexA, fixtureB, indexB) {
                const c = pool.pop() ?? new Contact();
                c.Reset(fixtureA, indexA, fixtureB, indexB);
                return c;
            },
            destroyFcn,
        };

        if (typeA !== typeB) {
            this.m_registers[typeB][typeA] = {
                createFcn(fixtureA, indexA, fixtureB, indexB) {
                    const c = pool.pop() ?? new Contact();
                    c.Reset(fixtureB, indexB, fixtureA, indexA);
                    return c;
                },
                destroyFcn,
            };
        }
    }

    public Create(fixtureA: b2Fixture, indexA: number, fixtureB: b2Fixture, indexB: number): b2Contact | null {
        const typeA = fixtureA.GetType();
        const typeB = fixtureB.GetType();

        // DEBUG: b2Assert(0 <= typeA && typeA < b2ShapeType.e_typeCount);
        // DEBUG: b2Assert(0 <= typeB && typeB < b2ShapeType.e_typeCount);

        const reg = this.m_registers[typeA][typeB];
        return reg ? reg.createFcn(fixtureA, indexA, fixtureB, indexB) : null;
    }

    public Destroy(contact: b2Contact): void {
        const typeA = contact.m_fixtureA.GetType();
        const typeB = contact.m_fixtureB.GetType();

        // DEBUG: b2Assert(0 <= typeA && typeB < b2ShapeType.e_typeCount);
        // DEBUG: b2Assert(0 <= typeA && typeB < b2ShapeType.e_typeCount);

        const reg = this.m_registers[typeA][typeB];
        reg?.destroyFcn(contact);
    }
}
