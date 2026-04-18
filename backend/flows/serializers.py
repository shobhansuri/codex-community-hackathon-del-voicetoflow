from rest_framework import serializers

from .models import Flow, FlowDoc, FlowEdge, FlowNode, NodeAction, NodeNote, Task


class NodeNoteSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = NodeNote
        fields = ['id', 'body', 'createdAt']


class FlowNodeSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='node_id')
    position = serializers.SerializerMethodField()
    notes = NodeNoteSerializer(many=True, read_only=True)

    class Meta:
        model = FlowNode
        fields = ['id', 'kind', 'title', 'description', 'position', 'data', 'notes']

    def get_position(self, obj):
        return {'x': obj.position_x, 'y': obj.position_y}


class FlowEdgeSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='edge_id')
    source = serializers.CharField(source='source_node_id')
    target = serializers.CharField(source='target_node_id')
    sourceHandle = serializers.CharField(source='source_handle')
    targetHandle = serializers.CharField(source='target_handle')

    class Meta:
        model = FlowEdge
        fields = [
            'id',
            'source',
            'target',
            'sourceHandle',
            'targetHandle',
            'label',
            'condition',
        ]


class TaskSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    nodeId = serializers.CharField(source='node.node_id', read_only=True)
    noteId = serializers.CharField(source='note_id', read_only=True)
    due = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = Task
        fields = [
            'id',
            'nodeId',
            'noteId',
            'title',
            'description',
            'assignee',
            'due',
            'channel',
            'status',
            'metadata',
            'createdAt',
        ]

    def get_due(self, obj):
        return (obj.metadata or {}).get('due', '')


class FlowDocSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    nodeId = serializers.CharField(source='node.node_id', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = FlowDoc
        fields = [
            'id',
            'nodeId',
            'title',
            'body',
            'createdAt',
            'updatedAt',
        ]


class NodeActionSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    nodeId = serializers.CharField(source='node.node_id', read_only=True)
    type = serializers.CharField(source='action_type')

    class Meta:
        model = NodeAction
        fields = ['id', 'nodeId', 'type', 'config', 'status']


class TaskExtractionExistingTaskSerializer(serializers.Serializer):
    title = serializers.CharField(trim_whitespace=True)
    description = serializers.CharField(
        allow_blank=True,
        default='',
        required=False,
        trim_whitespace=True,
    )
    assignee = serializers.CharField(
        allow_blank=True,
        default='',
        required=False,
        trim_whitespace=True,
    )
    due = serializers.CharField(
        allow_blank=True,
        default='',
        required=False,
        trim_whitespace=True,
    )
    channel = serializers.CharField(
        allow_blank=True,
        default='general',
        required=False,
        trim_whitespace=True,
    )
    status = serializers.CharField(
        allow_blank=True,
        default='todo',
        required=False,
        trim_whitespace=True,
    )


class TaskExtractionSuggestionSerializer(serializers.Serializer):
    title = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    assignee = serializers.CharField(allow_blank=True)
    due = serializers.CharField(allow_blank=True)
    channel = serializers.ChoiceField(
        choices=['general', 'whatsapp', 'call', 'email'],
    )


class TaskExtractionRequestSerializer(serializers.Serializer):
    allNotes = serializers.ListField(
        child=serializers.CharField(trim_whitespace=True),
        default=list,
        required=False,
    )
    nodeId = serializers.CharField(trim_whitespace=True)
    noteId = serializers.CharField(trim_whitespace=True)
    noteBody = serializers.CharField(trim_whitespace=True)
    flowName = serializers.CharField(
        allow_blank=True,
        default='',
        required=False,
        trim_whitespace=True,
    )
    flowDescription = serializers.CharField(
        allow_blank=True,
        default='',
        required=False,
        trim_whitespace=True,
    )
    aiContext = serializers.CharField(
        allow_blank=True,
        default='',
        required=False,
        trim_whitespace=True,
    )
    nodeTitle = serializers.CharField(
        allow_blank=True,
        default='',
        required=False,
        trim_whitespace=True,
    )
    nodeKind = serializers.CharField(
        allow_blank=True,
        default='',
        required=False,
        trim_whitespace=True,
    )
    existingTasks = TaskExtractionExistingTaskSerializer(
        many=True,
        default=list,
        required=False,
    )


class TaskExtractionResponseSerializer(serializers.Serializer):
    suggestions = TaskExtractionSuggestionSerializer(many=True)


class FlowListSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='uuid', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    nodeCount = serializers.IntegerField(source='node_count', read_only=True)
    edgeCount = serializers.IntegerField(source='edge_count', read_only=True)

    class Meta:
        model = Flow
        fields = [
            'id',
            'name',
            'description',
            'createdAt',
            'updatedAt',
            'nodeCount',
            'edgeCount',
        ]


class FlowDetailSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='uuid', read_only=True)
    aiContext = serializers.CharField(
        allow_blank=True,
        required=False,
        source='ai_context',
    )
    nodes = FlowNodeSerializer(many=True, read_only=True)
    edges = FlowEdgeSerializer(many=True, read_only=True)
    docs = FlowDocSerializer(many=True, read_only=True)
    tasks = TaskSerializer(many=True, read_only=True)
    actions = NodeActionSerializer(many=True, read_only=True)

    class Meta:
        model = Flow
        fields = [
            'id',
            'name',
            'description',
            'aiContext',
            'settings',
            'nodes',
            'edges',
            'docs',
            'tasks',
            'actions',
        ]
