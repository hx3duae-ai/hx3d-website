"use client";
import { useEffect, useLayoutEffect } from "react";

// useLayoutEffect on the client (runs before paint, so "from" states never flash), useEffect on the server.
export const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
