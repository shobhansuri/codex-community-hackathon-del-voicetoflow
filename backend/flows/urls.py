from django.urls import path

from .views import (
    FlowDetailView,
    FlowListCreateView,
    FlowRealtimeSessionView,
    NoteTaskExtractionView,
    health_check,
)

urlpatterns = [
    path('health/', health_check, name='health_check'),
    path('flows/', FlowListCreateView.as_view(), name='flow_list_create'),
    path(
        'flows/<uuid:flow_uuid>/notes/extract-tasks/',
        NoteTaskExtractionView.as_view(),
        name='note_task_extraction',
    ),
    path(
        'flows/<uuid:flow_uuid>/realtime/session/',
        FlowRealtimeSessionView.as_view(),
        name='flow_realtime_session',
    ),
    path('flows/<uuid:flow_uuid>/', FlowDetailView.as_view(), name='flow_detail'),
]
