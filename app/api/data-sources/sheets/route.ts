import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { dataSourceToClient } from "@/lib/data-sources"
import { removeSourceDb } from "@/lib/engines/sql/store"
import { readTables } from "@/lib/engines/sql/tables"
import { isConnected } from "@/lib/integrations/google/auth"
import { extractSpreadsheetId } from "@/lib/integrations/google/ids"
import { GoogleApiError } from "@/lib/integrations/google/errors"
import { isRefreshInterval } from "@/lib/integrations/google/intervals"
import {
  assertSpreadsheet,
  fetchDriveFile,
  syncSheet,
} from "@/lib/integrations/google/sheets"

// POST /api/data-sources/sheets — connect a Google spreadsheet as a data source.
export async function POST(request: NextRequest) {
  let body: {
    name?: string
    description?: string
    spreadsheetId?: string
    url?: string
    refreshInterval?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!(await isConnected())) {
    return NextResponse.json({ error: "Connect Google in Settings first." }, { status: 409 })
  }

  const spreadsheetId = extractSpreadsheetId(body.spreadsheetId ?? body.url ?? "")
  if (!spreadsheetId) {
    return NextResponse.json({ error: "A spreadsheet is required." }, { status: 400 })
  }
  const refreshInterval = isRefreshInterval(body.refreshInterval ?? "")
    ? body.refreshInterval!
    : "manual"

  let file
  try {
    file = await fetchDriveFile(spreadsheetId)
    assertSpreadsheet(file)
  } catch (error) {
    if (error instanceof GoogleApiError) {
      console.error("[data-sources/sheets] drive lookup failed:", error.status, error.message)
      const hint =
        error.status === 404
          ? " (the Picker must run with the app id so a drive.file pick is shared with the app)"
          : ""
      return NextResponse.json(
        { error: error.message + hint },
        { status: error.status === 404 ? 404 : 422 },
      )
    }
    throw error
  }

  const source = await prisma.dataSource.create({
    data: {
      name: body.name?.trim() || file.name,
      description: body.description?.trim() || undefined,
      type: "sheets",
      status: "connected",
      sheetId: spreadsheetId,
      refreshInterval,
    },
  })

  try {
    await syncSheet(source.id, spreadsheetId)
    const updated = await prisma.dataSource.update({
      where: { id: source.id },
      data: {
        sheetModifiedAt: new Date(file.modifiedTime),
        lastSyncedAt: new Date(),
        syncError: null,
      },
    })
    return NextResponse.json(
      { ...dataSourceToClient(updated), tables: readTables(source.id) },
      { status: 201 },
    )
  } catch (error) {
    await prisma.dataSource.delete({ where: { id: source.id } }).catch(() => {})
    removeSourceDb(source.id)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not read the spreadsheet" },
      { status: 422 },
    )
  }
}
