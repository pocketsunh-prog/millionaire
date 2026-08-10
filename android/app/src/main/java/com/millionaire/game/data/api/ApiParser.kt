package com.millionaire.game.data.api

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import okhttp3.ResponseBody

/**
 * Parses raw API response bodies.
 *
 * [ApiService] methods return `Response<ResponseBody>` — a concrete type Retrofit passes
 * straight through (its built-in ResponseBody converter handles it) without asking Gson to
 * resolve the method's generic return type. That matters because R8 strips the generic
 * `Signature` attribute from the interface methods in release builds; if Gson tried to read
 * that signature it would crash with "Class cannot be cast to ParameterizedType".
 *
 * We instead parse here with explicit [TypeToken]s written in app code. These capture the
 * element type at compile time (via the anonymous subclass's generic supertype), so they do
 * not depend on the erased JVM signature at all.
 */
object ApiParser {
    private val gson = Gson()

    private val mapListType = object : TypeToken<List<Map<String, Any>>>() {}.type
    private val mapType = object : TypeToken<Map<String, Any>>() {}.type

    fun parseMap(body: ResponseBody): Map<String, Any> =
        gson.fromJson(body.string(), mapType) ?: emptyMap()

    fun parseList(body: ResponseBody): List<Map<String, Any>> =
        gson.fromJson(body.string(), mapListType) ?: emptyList()
}
