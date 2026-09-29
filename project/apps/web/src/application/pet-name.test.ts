import { describe, expect, it } from "vitest";
import { petName, personalizePetText } from "./pet-name";

describe("pet names in authored copy", () => {
  it.each([
    ["Гаврик", "Гаврика", "Гаврику", "Гаврика"],
    ["Кузя", "Кузю", "Кузе", "Кузи"],
    ["Маша", "Машу", "Маше", "Маши"],
    ["малыш", "малыша", "малышу", "малыша"],
    ["Щенок", "Щенка", "Щенку", "Щенка"],
    ["крокозябра", "крокозябру", "крокозябре", "крокозябры"],
    ["Финни", "Финни", "Финни", "Финни"],
    ["Мария", "Марию", "Марии", "Марии"],
    ["ГАВРИК", "ГАВРИКА", "ГАВРИКУ", "ГАВРИКА"],
  ])("%s: feeding, returning and ownership", (name, acc, dat, gen) => {
    expect(personalizePetText("Покормить Финни", name)).toBe(`Покормить ${acc}`);
    expect(personalizePetText("Вернуться к Финни", name)).toBe(`Вернуться к ${dat}`);
    expect(personalizePetText("Мечта Финни", name)).toBe(`Мечта ${gen}`);
    expect(petName(name)).toBe(name);
  });
  it.each(["Zz-42", "Синяя Искра", "Любовь", "<img>", "Смешной"])("uses pet as fallback for %s, preserving the actual name", name => {
    expect(petName(name)).toBe(name);
    expect(personalizePetText("К Финни", name)).toBe("К питомцу");
    expect(personalizePetText("Покормить Финни", name)).toBe("Покормить питомца");
    expect(personalizePetText("Финни радуется!", name)).toBe(`${name} радуется!`);
  });
  it("handles different grammatical contexts in one message", () => {
    expect(petName("Маша", "ins")).toBe("Машей");
    expect(personalizePetText("Финни радуется. Поможем Финни! Заботиться о Финни. Вместе с Финни.", "Гаврик"))
      .toBe("Гаврик радуется. Поможем Гаврику! Заботиться о Гаврике. Вместе с Гавриком.");
    expect(personalizePetText("То, что нужно голодному Финни.", "Кузя")).toBe("То, что нужно голодному Кузе.");
  });
});
