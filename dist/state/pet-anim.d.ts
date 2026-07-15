export interface PetAnim {
    offset: number;
    mirrored: boolean;
    atMs: number;
}
export declare function readPetAnim(transcriptPath: string): PetAnim | null;
export declare function writePetAnim(transcriptPath: string, anim: PetAnim): void;
//# sourceMappingURL=pet-anim.d.ts.map