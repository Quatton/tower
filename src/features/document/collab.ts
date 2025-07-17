import { ElementNode } from "lexical";

export class CollabElementNode extends ElementNode {
  static getType(): string {
    return "collab-element";
  }
}
