<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Support\Present;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * frontend/lib/settings-context.tsx persisted everything to localStorage only
 * (key net_app_settings_v2). This gives company/notification settings a real
 * server home; profile/password/theme/language stay client concerns.
 */
class SettingsController extends Controller
{
    private function current(): Setting
    {
        return Setting::query()->firstOrCreate([], [
            'company_name' => 'Near East Technology',
            'tax_office' => 'Lefkoşa Vergi Dairesi',
            'tax_number' => '1234567890',
            'address' => 'Lefkoşa, KKTC',
        ]);
    }

    public function show()
    {
        return response()->json(Present::settings($this->current()));
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'company' => ['sometimes', 'array'],
            'company.companyName' => ['sometimes', 'string'],
            'company.taxOffice' => ['sometimes', 'string'],
            'company.taxNumber' => ['sometimes', 'string'],
            'company.address' => ['sometimes', 'string'],
            'notifications' => ['sometimes', 'array'],
            'notifications.notifyStock' => ['sometimes', 'boolean'],
            'notifications.notifyOrder' => ['sometimes', 'boolean'],
            'notifications.notifySystem' => ['sometimes', 'boolean'],
            'timezone' => ['sometimes', 'string'],
            'showKurus' => ['sometimes', 'boolean'],
            'defaultRange' => ['sometimes', 'in:bu-ay,son-3-ay,son-6-ay,bu-yil'],
        ]);

        $settings = DB::transaction(function () use ($data) {
            $settings = $this->current();

            $map = [
                'company.companyName' => 'company_name',
                'company.taxOffice' => 'tax_office',
                'company.taxNumber' => 'tax_number',
                'company.address' => 'address',
                'notifications.notifyStock' => 'notify_stock',
                'notifications.notifyOrder' => 'notify_order',
                'notifications.notifySystem' => 'notify_system',
                'timezone' => 'timezone',
                'showKurus' => 'show_kurus',
                'defaultRange' => 'default_range',
            ];

            foreach ($map as $path => $column) {
                $value = data_get($data, $path);
                if ($value !== null) {
                    $settings->{$column} = $value;
                }
            }
            $settings->save();

            return $settings;
        });

        return response()->json(Present::settings($settings));
    }
}
