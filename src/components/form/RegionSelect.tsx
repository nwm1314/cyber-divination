"use client";

import { Field, inputClass } from "./Field";
import {
  listCities,
  listProvinces,
  lookupLng,
} from "@/lib/geo/china-regions";

type Props = {
  province: string;
  city: string;
  lng: string;
  onChange: (next: { province: string; city: string; lng: string }) => void;
};

export function RegionSelect({ province, city, lng, onChange }: Props) {
  const provinces = listProvinces();
  const cities = province ? listCities(province) : [];

  return (
    <div className="space-y-4">
      <Field label="出生省份" hint="下拉选择；用于真太阳时自动填经度">
        <select
          className={inputClass}
          value={province}
          aria-label="出生省份"
          onChange={(e) => {
            const p = e.target.value;
            const first = listCities(p)[0];
            const nextCity = first?.name ?? "";
            const nextLng =
              first != null ? String(first.lng) : "";
            onChange({ province: p, city: nextCity, lng: nextLng });
          }}
        >
          <option value="">请选择省份</option>
          {provinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>

      <Field label="出生城市" hint="选择城市后自动带出经度">
        <select
          className={inputClass}
          value={city}
          disabled={!province}
          aria-label="出生城市"
          onChange={(e) => {
            const c = e.target.value;
            const auto = lookupLng(province, c);
            onChange({
              province,
              city: c,
              lng: auto != null ? String(auto) : lng,
            });
          }}
        >
          <option value="">{province ? "请选择城市" : "请先选省份"}</option>
          {cities.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="出生地经度"
        hint={
          lng
            ? "已由城市自动填入，一般无需改；真太阳时用"
            : "选省市后自动填入，也可手改"
        }
      >
        <input
          type="number"
          step="0.01"
          className={inputClass}
          value={lng}
          onChange={(e) =>
            onChange({ province, city, lng: e.target.value })
          }
          placeholder="选择城市后自动填写"
          min={70}
          max={140}
          aria-label="出生地经度"
        />
      </Field>
    </div>
  );
}
